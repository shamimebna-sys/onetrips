import { prisma } from "@onetrips/database";
import { AppError, RateLimitError } from "@onetrips/shared";
import { enqueueNotification, isEmailConfigured } from "@onetrips/notifications";
import { logError } from "@onetrips/observability";
import { AuthError } from "./errors";
import { generateOtpCode, hashOtp, otpMatches } from "./crypto";
import { hashPassword, verifyPassword } from "./passwords";
import { consumeRateLimit, RATE_LIMITS } from "./rate-limit";
import {
  accessCookieOptions,
  refreshCookieOptions,
  mfaCookieOptions,
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  MFA_COOKIE,
  type AuthCookieOptions,
} from "./cookies";
import {
  b2bRegisterSchema,
  customerRegisterSchema,
  loginSchema,
  otpRequestSchema,
  otpVerifySchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "./schemas";
import { issueSession, revokeSessionByRefresh, rotateSession, toPublicUser } from "./session";
import { signAccessToken, verifyAccessToken } from "./tokens";

export type CookieSet = {
  name: string;
  value: string;
  options: AuthCookieOptions;
};

export type AuthHttpResult = {
  status: number;
  body: Record<string, unknown>;
  headers?: Record<string, string>;
  setCookies?: CookieSet[];
  clearCookies?: string[];
};

type RequestContext = {
  ipAddress?: string;
  userAgent?: string;
  accessToken?: string;
  refreshToken?: string;
  mfaToken?: string;
};

function fail(error: unknown): AuthHttpResult {
  if (error instanceof RateLimitError) {
    return {
      status: error.httpStatus,
      body: error.toPublicJSON(),
      headers: { "Retry-After": String(error.retryAfterSec) },
    };
  }
  if (error instanceof AppError) {
    return { status: error.httpStatus, body: error.toPublicJSON() };
  }
  logError(error, { area: "auth" });
  return {
    status: 500,
    body: { code: "INTERNAL", message: "Something went wrong. Please try again." },
  };
}

function sessionCookies(accessToken: string, refreshToken: string): CookieSet[] {
  return [
    { name: ACCESS_COOKIE, value: accessToken, options: accessCookieOptions() },
    { name: REFRESH_COOKIE, value: refreshToken, options: refreshCookieOptions() },
  ];
}

async function recordLogin(userId: string, status: string, ctx: RequestContext) {
  await prisma.userLoginHistory.create({
    data: {
      userId,
      status,
      ipAddress: ctx.ipAddress?.slice(0, 64),
      device: ctx.userAgent?.slice(0, 255),
    },
  });
}

async function audit(params: {
  actorId?: string;
  actorType: string;
  action: string;
  entityId: string;
  ipAddress?: string;
  reason?: string;
}) {
  await prisma.auditLog.create({
    data: {
      actorId: params.actorId,
      actorType: params.actorType,
      action: params.action,
      entityType: "User",
      entityId: params.entityId,
      ipAddress: params.ipAddress?.slice(0, 64),
      reason: params.reason,
    },
  });
}

async function assignRole(userId: string, roleName: string, organizationId?: string) {
  const role = await prisma.role.findUnique({ where: { name: roleName } });
  if (!role) {
    throw new AuthError("ROLE_MISSING", "Required role is not seeded.", 500);
  }
  await prisma.userRole.create({
    data: { userId, roleId: role.id, organizationId },
  });
}

async function migrateLegacyAgent(email: string) {
  const agent = await prisma.agent.findUnique({ where: { email } });
  if (!agent) return null;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return existing;

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: agent.email,
        phone: agent.phone,
        passwordHash: agent.password,
        displayName: agent.fullName,
        type: "B2B",
        status: "ACTIVE",
      },
    });
    const organization = await tx.organization.create({
      data: {
        name: agent.companyName,
        type: "AGENCY",
        status: "ACTIVE",
        country: agent.country,
        city: agent.city,
        nidUrl: agent.nidUrl,
        tradeLicenseUrl: agent.tradeLicenseUrl,
      },
    });
    await tx.organizationUser.create({
      data: {
        organizationId: organization.id,
        userId: user.id,
        role: "OWNER",
      },
    });
    const role = await tx.role.findUnique({ where: { name: "B2B_OWNER" } });
    if (role) {
      await tx.userRole.create({
        data: { userId: user.id, roleId: role.id, organizationId: organization.id },
      });
    }
    return user;
  });
}

export async function registerCustomer(input: unknown, ctx: RequestContext = {}): Promise<AuthHttpResult> {
  try {
    const data = customerRegisterSchema.parse(input);
    const email = data.email.toLowerCase();
    const limit = await consumeRateLimit(`register:${ctx.ipAddress ?? email}`, RATE_LIMITS.register.limit, RATE_LIMITS.register.windowMs);
    if (!limit.ok) {
      throw new RateLimitError("Too many registration attempts. Try again later.", limit.retryAfterSec);
    }

    const taken = await prisma.user.findFirst({
      where: { OR: [{ email }, { phone: data.phone }] },
    });
    if (taken) {
      throw new AuthError("ACCOUNT_EXISTS", "An account with this email or phone already exists.", 409);
    }

    const passwordHash = await hashPassword(data.password);
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email,
          phone: data.phone,
          passwordHash,
          displayName: `${data.firstName} ${data.lastName}`,
          type: "CUSTOMER",
          status: "PENDING",
        },
      });
      await tx.customer.create({
        data: {
          userId: created.id,
          firstName: data.firstName,
          lastName: data.lastName,
          marketingConsentAt: data.marketingConsent ? new Date() : null,
        },
      });
      return created;
    });

    await assignRole(user.id, "CUSTOMER");
    const otp = await createOtp({
      destination: email,
      channel: "EMAIL",
      purpose: "REGISTER",
    });
    await audit({
      actorId: user.id,
      actorType: "CUSTOMER",
      action: "auth.register.customer",
      entityId: user.id,
    });

    return {
      status: 201,
      body: {
        message: "Account created. Enter the verification code sent to your email.",
        email,
        ...(otp.devCode ? { devCode: otp.devCode } : {}),
      },
    };
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return { status: 400, body: { code: "VALIDATION", message: error.message } };
    }
    return fail(error);
  }
}

export async function registerB2b(input: unknown, ctx: RequestContext = {}): Promise<AuthHttpResult> {
  try {
    const data = b2bRegisterSchema.parse(input);
    const email = data.email.toLowerCase();
    const limit = await consumeRateLimit(`register:${ctx.ipAddress ?? email}`, RATE_LIMITS.register.limit, RATE_LIMITS.register.windowMs);
    if (!limit.ok) {
      throw new RateLimitError("Too many registration attempts. Try again later.", limit.retryAfterSec);
    }

    const taken = await prisma.user.findUnique({ where: { email } });
    if (taken) {
      throw new AuthError("ACCOUNT_EXISTS", "Email already exists.", 409);
    }

    const passwordHash = await hashPassword(data.password);
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email,
          phone: data.phone,
          passwordHash,
          displayName: data.fullName,
          type: "B2B",
          status: "ACTIVE",
        },
      });
      const organization = await tx.organization.create({
        data: {
          name: data.companyName,
          type: "AGENCY",
          status: "ACTIVE",
          country: data.country,
          city: data.city,
          nidUrl: data.nidUrl,
          tradeLicenseUrl: data.tradeLicenseUrl ?? null,
        },
      });
      await tx.organizationUser.create({
        data: {
          organizationId: organization.id,
          userId: created.id,
          role: "OWNER",
        },
      });
      const role = await tx.role.findUnique({ where: { name: "B2B_OWNER" } });
      if (role) {
        await tx.userRole.create({
          data: { userId: created.id, roleId: role.id, organizationId: organization.id },
        });
      }
      return created;
    });

    await audit({
      actorId: user.id,
      actorType: "B2B",
      action: "auth.register.b2b",
      entityId: user.id,
    });

    return {
      status: 201,
      body: { message: "Registration successful.", success: true },
    };
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return { status: 400, body: { code: "VALIDATION", message: error.message } };
    }
    return fail(error);
  }
}

export async function login(input: unknown, ctx: RequestContext): Promise<AuthHttpResult> {
  try {
    const data = loginSchema.parse(input);
    const email = data.email.toLowerCase();
    const limit = await consumeRateLimit(`login:${ctx.ipAddress ?? email}`, RATE_LIMITS.login.limit, RATE_LIMITS.login.windowMs);
    if (!limit.ok) {
      throw new RateLimitError("Too many login attempts. Try again later.", limit.retryAfterSec);
    }

    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await migrateLegacyAgent(email);
    }
    if (!user || !user.passwordHash) {
      throw new AuthError("INVALID_CREDENTIALS", "Invalid email or password.");
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new AuthError("LOCKED", "Account temporarily locked. Try again later.", 423);
    }

    const valid = await verifyPassword(data.password, user.passwordHash);
    if (!valid) {
      const failedLoginCount = user.failedLoginCount + 1;
      const lockedUntil = failedLoginCount >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null;
      await prisma.user.update({
        where: { id: user.id },
        data: { failedLoginCount, lockedUntil },
      });
      await recordLogin(user.id, "FAILED", ctx);
      throw new AuthError("INVALID_CREDENTIALS", "Invalid email or password.");
    }

    if (user.status === "PENDING") {
      throw new AuthError("UNVERIFIED", "Verify your email before signing in.", 403);
    }
    if (user.status !== "ACTIVE" || user.deletedAt) {
      throw new AuthError("ACCOUNT_DISABLED", "This account is not active.", 403);
    }

    if (user.type === "ADMIN") {
      const otp = await createOtp({
        destination: email,
        channel: "EMAIL",
        purpose: "LOGIN",
      });
      const mfaToken = signAccessToken({
        sub: user.id,
        email,
        type: "ADMIN",
        permissions: [],
      });
      await recordLogin(user.id, "MFA_REQUIRED", ctx);
      return {
        status: 200,
        body: {
          mfaRequired: true,
          message: "Enter the verification code sent to your email.",
          email,
          ...(otp.devCode ? { devCode: otp.devCode } : {}),
        },
        setCookies: [{ name: MFA_COOKIE, value: mfaToken, options: mfaCookieOptions() }],
      };
    }

    const session = await issueSession({
      userId: user.id,
      email: user.email,
      type: user.type,
      ipAddress: ctx.ipAddress,
      deviceInfo: ctx.userAgent,
    });
    await recordLogin(user.id, "SUCCESS", ctx);
    await audit({
      actorId: user.id,
      actorType: user.type,
      action: "auth.login",
      entityId: user.id,
      ipAddress: ctx.ipAddress,
    });

    return {
      status: 200,
      body: {
        message: "Login successful",
        user: await toPublicUser(user.id),
      },
      setCookies: sessionCookies(session.accessToken, session.refreshToken),
    };
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return { status: 400, body: { code: "VALIDATION", message: error.message } };
    }
    return fail(error);
  }
}

async function createOtp(params: {
  destination: string;
  channel: "EMAIL" | "SMS";
  purpose: "REGISTER" | "LOGIN" | "RESET" | "PHONE_VERIFY";
}) {
  const limit = await consumeRateLimit(`otp:${params.destination}:${params.purpose}`, RATE_LIMITS.otp.limit, RATE_LIMITS.otp.windowMs);
  if (!limit.ok) {
    throw new RateLimitError("Too many OTP requests. Try again later.", limit.retryAfterSec);
  }

  // Temporary fallback while SMTP is unset. Remove when email is always configured.
  const useEmailFallback = params.channel === "EMAIL" && !isEmailConfigured();
  const code = useEmailFallback ? "000000" : generateOtpCode();
  await prisma.otpChallenge.create({
    data: {
      destination: params.destination.toLowerCase(),
      channel: params.channel,
      purpose: params.purpose,
      codeHash: hashOtp(code, params.destination.toLowerCase()),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    },
  });

  if (!useEmailFallback) {
    try {
      await enqueueNotification({
        channel: params.channel,
        recipient: params.destination,
        template: params.channel === "SMS" ? "SMS_OTP" : "OTP",
        payload: { code, purpose: params.purpose },
      });
    } catch (error) {
      console.error("OTP notification failed", error);
    }
  }

  if (process.env.NODE_ENV !== "production") {
    console.info(`[OTP] ${params.purpose} ${params.destination}: ${code}`);
    return { devCode: code };
  }
  return {};
}

export async function requestOtp(input: unknown): Promise<AuthHttpResult> {
  try {
    const data = otpRequestSchema.parse(input);
    const otp = await createOtp({
      destination: data.destination.toLowerCase(),
      channel: data.channel,
      purpose: data.purpose,
    });
    return {
      status: 200,
      body: {
        message: "If the account exists, a verification code was sent.",
        ...(otp.devCode ? { devCode: otp.devCode } : {}),
      },
    };
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return { status: 400, body: { code: "VALIDATION", message: error.message } };
    }
    return fail(error);
  }
}

export async function verifyOtp(input: unknown, ctx: RequestContext): Promise<AuthHttpResult> {
  try {
    const data = otpVerifySchema.parse(input);
    const destination = data.destination.toLowerCase();
    const challenge = await prisma.otpChallenge.findFirst({
      where: { destination, purpose: data.purpose, consumedAt: null },
      orderBy: { createdAt: "desc" },
    });

    if (!challenge || challenge.expiresAt < new Date()) {
      throw new AuthError("OTP_INVALID", "Invalid or expired verification code.");
    }
    if (challenge.attempts >= 3) {
      throw new AuthError("OTP_LOCKED", "Too many incorrect codes. Request a new one.", 429);
    }

    if (!otpMatches(data.code, destination, challenge.codeHash)) {
      await prisma.otpChallenge.update({
        where: { id: challenge.id },
        data: { attempts: { increment: 1 } },
      });
      throw new AuthError("OTP_INVALID", "Invalid or expired verification code.");
    }

    await prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: { consumedAt: new Date() },
    });

    if (data.purpose === "REGISTER") {
      const user = await prisma.user.findUnique({ where: { email: destination } });
      if (!user) throw new AuthError("USER_NOT_FOUND", "User not found.", 404);
      await prisma.user.update({
        where: { id: user.id },
        data: { status: "ACTIVE", emailVerifiedAt: new Date() },
      });
      const session = await issueSession({
        userId: user.id,
        email: user.email,
        type: user.type,
        ipAddress: ctx.ipAddress,
        deviceInfo: ctx.userAgent,
      });
      return {
        status: 200,
        body: { message: "Email verified.", user: await toPublicUser(user.id) },
        setCookies: sessionCookies(session.accessToken, session.refreshToken),
      };
    }

    if (data.purpose === "LOGIN") {
      if (!ctx.mfaToken) {
        throw new AuthError("MFA_REQUIRED", "Admin verification session missing.");
      }
      const mfa = verifyAccessToken(ctx.mfaToken);
      const user = await prisma.user.findUnique({ where: { id: mfa.sub } });
      if (!user || user.email?.toLowerCase() !== destination || user.type !== "ADMIN") {
        throw new AuthError("OTP_INVALID", "Invalid or expired verification code.");
      }
      const session = await issueSession({
        userId: user.id,
        email: user.email,
        type: user.type,
        ipAddress: ctx.ipAddress,
        deviceInfo: ctx.userAgent,
      });
      await recordLogin(user.id, "SUCCESS", ctx);
      return {
        status: 200,
        body: { message: "Login successful", user: await toPublicUser(user.id) },
        setCookies: [
          ...sessionCookies(session.accessToken, session.refreshToken),
        ],
        clearCookies: [MFA_COOKIE],
      };
    }

    return { status: 200, body: { message: "Code verified." } };
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return { status: 400, body: { code: "VALIDATION", message: error.message } };
    }
    return fail(error);
  }
}

export async function refresh(ctx: RequestContext): Promise<AuthHttpResult> {
  try {
    if (!ctx.refreshToken) {
      throw new AuthError("INVALID_REFRESH", "Session expired. Please sign in again.");
    }
    const session = await rotateSession(ctx.refreshToken);
    return {
      status: 200,
      body: { message: "Session refreshed." },
      setCookies: sessionCookies(session.accessToken, session.refreshToken),
    };
  } catch (error) {
    return fail(error);
  }
}

export async function issueOtp(params: {
  destination: string;
  channel: "EMAIL" | "SMS";
  purpose: "REGISTER" | "LOGIN" | "RESET" | "PHONE_VERIFY";
}) {
  return createOtp(params);
}

export async function consumeOtp(
  destination: string,
  purpose: "REGISTER" | "LOGIN" | "RESET" | "PHONE_VERIFY",
  code: string,
) {
  const dest = destination.toLowerCase();
  const challenge = await prisma.otpChallenge.findFirst({
    where: { destination: dest, purpose, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });

  if (!challenge || challenge.expiresAt < new Date()) {
    throw new AuthError("OTP_INVALID", "Invalid or expired verification code.");
  }
  if (challenge.attempts >= 3) {
    throw new AuthError("OTP_LOCKED", "Too many incorrect codes. Request a new one.", 429);
  }
  if (!otpMatches(code, dest, challenge.codeHash)) {
    await prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: { attempts: { increment: 1 } },
    });
    throw new AuthError("OTP_INVALID", "Invalid or expired verification code.");
  }

  await prisma.otpChallenge.update({
    where: { id: challenge.id },
    data: { consumedAt: new Date() },
  });
}

export async function changePassword(userId: string, input: unknown) {
  const data = changePasswordSchema.parse(input);
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.passwordHash) {
    throw new AuthError("USER_NOT_FOUND", "User not found.", 404);
  }
  const valid = await verifyPassword(data.currentPassword, user.passwordHash);
  if (!valid) {
    throw new AuthError("INVALID_CREDENTIALS", "Current password is incorrect.");
  }
  if (data.currentPassword === data.newPassword) {
    throw new AuthError("PASSWORD_UNCHANGED", "New password must be different.", 400);
  }
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(data.newPassword) },
  });
  await prisma.auditLog.create({
    data: {
      actorId: userId,
      actorType: user.type,
      action: "auth.password.change",
      entityType: "User",
      entityId: userId,
    },
  });
}

export async function forgotPassword(input: unknown, ctx: RequestContext = {}): Promise<AuthHttpResult> {
  try {
    const data = forgotPasswordSchema.parse(input);
    const email = data.email.toLowerCase();
    const limit = await consumeRateLimit(`reset:${ctx.ipAddress ?? email}`, RATE_LIMITS.otp.limit, RATE_LIMITS.otp.windowMs);
    if (!limit.ok) {
      throw new RateLimitError("Too many reset attempts. Try again later.", limit.retryAfterSec);
    }

    const user = await prisma.user.findUnique({ where: { email } });
    let devCode: string | undefined;
    if (user && user.type === "CUSTOMER" && !user.deletedAt) {
      const otp = await createOtp({ destination: email, channel: "EMAIL", purpose: "RESET" });
      devCode = otp.devCode;
      await audit({
        actorId: user.id,
        actorType: "CUSTOMER",
        action: "auth.password.forgot",
        entityId: user.id,
        ipAddress: ctx.ipAddress,
      });
    }

    return {
      status: 200,
      body: {
        message: "If an account exists for that email, a verification code was sent.",
        ...(devCode ? { devCode } : {}),
      },
    };
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return { status: 400, body: { code: "VALIDATION", message: error.message } };
    }
    return fail(error);
  }
}

export async function resetPassword(input: unknown, ctx: RequestContext = {}): Promise<AuthHttpResult> {
  try {
    const data = resetPasswordSchema.parse(input);
    const email = data.email.toLowerCase();
    await consumeOtp(email, "RESET", data.code);
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || user.type !== "CUSTOMER" || user.deletedAt) {
      throw new AuthError("OTP_INVALID", "Invalid or expired verification code.");
    }
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await hashPassword(data.password),
        failedLoginCount: 0,
        lockedUntil: null,
      },
    });
    await prisma.userSession.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await audit({
      actorId: user.id,
      actorType: "CUSTOMER",
      action: "auth.password.reset",
      entityId: user.id,
      ipAddress: ctx.ipAddress,
    });
    return { status: 200, body: { message: "Password updated. Please sign in." } };
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return { status: 400, body: { code: "VALIDATION", message: error.message } };
    }
    return fail(error);
  }
}

export async function logout(ctx: RequestContext): Promise<AuthHttpResult> {
  await revokeSessionByRefresh(ctx.refreshToken);
  return {
    status: 200,
    body: { message: "Signed out." },
    clearCookies: [ACCESS_COOKIE, REFRESH_COOKIE, MFA_COOKIE],
  };
}

export type SessionTokens = {
  accessToken?: string;
  refreshToken?: string;
};

export type ResolvedSession = {
  payload: ReturnType<typeof verifyAccessToken>;
  setCookies?: CookieSet[];
};

export async function resolveSession(ctx: SessionTokens): Promise<ResolvedSession | null> {
  if (ctx.accessToken) {
    try {
      return { payload: verifyAccessToken(ctx.accessToken) };
    } catch {
      // Access expired or invalid — fall through to refresh.
    }
  }
  if (!ctx.refreshToken) return null;
  const session = await rotateSession(ctx.refreshToken);
  return {
    payload: verifyAccessToken(session.accessToken),
    setCookies: sessionCookies(session.accessToken, session.refreshToken),
  };
}

export async function me(ctx: RequestContext): Promise<AuthHttpResult> {
  try {
    const resolved = await resolveSession(ctx);
    if (!resolved) {
      throw new AuthError("UNAUTHENTICATED", "Please sign in.");
    }
    return {
      status: 200,
      body: { user: await toPublicUser(resolved.payload.sub) },
      setCookies: resolved.setCookies,
    };
  } catch (error) {
    return fail(error);
  }
}

export function getAccessPayload(accessToken?: string) {
  if (!accessToken) return null;
  try {
    return verifyAccessToken(accessToken);
  } catch {
    return null;
  }
}

export { loadPermissions, assertPermission } from "./rbac";
export { ACCESS_COOKIE, REFRESH_COOKIE, MFA_COOKIE } from "./cookies";
export { verifyAccessToken, type AccessTokenPayload } from "./tokens";
