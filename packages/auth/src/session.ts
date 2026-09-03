import { prisma } from "@onetrips/database";
import { AuthError } from "./errors";
import { hashToken } from "./crypto";
import { loadPermissions } from "./rbac";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  type AccessTokenPayload,
} from "./tokens";

export type SessionCookies = {
  accessToken: string;
  refreshToken: string;
};

export async function issueSession(params: {
  userId: string;
  email?: string | null;
  type: AccessTokenPayload["type"];
  ipAddress?: string;
  deviceInfo?: string;
}): Promise<SessionCookies> {
  const permissions = await loadPermissions(params.userId);
  const session = await prisma.userSession.create({
    data: {
      userId: params.userId,
      refreshTokenHash: "pending",
      ipAddress: params.ipAddress?.slice(0, 64),
      deviceInfo: params.deviceInfo?.slice(0, 255),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  const refreshToken = signRefreshToken({ sub: params.userId, sid: session.id });
  await prisma.userSession.update({
    where: { id: session.id },
    data: { refreshTokenHash: hashToken(refreshToken) },
  });

  const accessToken = signAccessToken({
    sub: params.userId,
    email: params.email ?? undefined,
    type: params.type,
    permissions,
  });

  await prisma.user.update({
    where: { id: params.userId },
    data: { lastLoginAt: new Date(), failedLoginCount: 0, lockedUntil: null },
  });

  return { accessToken, refreshToken };
}

const ROTATE_REPLAY_MS = 10_000;
const rotateInFlight = new Map<string, Promise<SessionCookies>>();
const rotateReplay = new Map<string, { cookies: SessionCookies; expiresAt: number }>();

function replayFor(refreshToken: string): SessionCookies | null {
  const entry = rotateReplay.get(hashToken(refreshToken));
  if (!entry || entry.expiresAt <= Date.now()) return null;
  return entry.cookies;
}

function rememberRotation(refreshToken: string, cookies: SessionCookies) {
  const key = hashToken(refreshToken);
  rotateReplay.set(key, { cookies, expiresAt: Date.now() + ROTATE_REPLAY_MS });
  const timer = setTimeout(() => {
    const current = rotateReplay.get(key);
    if (current && current.expiresAt <= Date.now()) rotateReplay.delete(key);
  }, ROTATE_REPLAY_MS + 50);
  timer.unref?.();
}

async function rotateSessionUnlocked(refreshToken: string, payload: { sub: string; sid: string }): Promise<SessionCookies> {
  const session = await prisma.userSession.findUnique({
    where: { id: payload.sid },
    include: { user: true },
  });

  if (!session || session.revokedAt || session.expiresAt < new Date()) {
    throw new AuthError("INVALID_REFRESH", "Session expired. Please sign in again.");
  }

  if (session.refreshTokenHash !== hashToken(refreshToken)) {
    await prisma.userSession.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });
    throw new AuthError("INVALID_REFRESH", "Session expired. Please sign in again.");
  }

  if (session.user.status !== "ACTIVE" || session.user.deletedAt) {
    throw new AuthError("ACCOUNT_DISABLED", "This account is not active.", 403);
  }

  const permissions = await loadPermissions(session.userId);
  const nextRefresh = signRefreshToken({ sub: session.userId, sid: session.id });
  await prisma.userSession.update({
    where: { id: session.id },
    data: {
      refreshTokenHash: hashToken(nextRefresh),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  return {
    accessToken: signAccessToken({
      sub: session.userId,
      email: session.user.email ?? undefined,
      type: session.user.type,
      permissions,
    }),
    refreshToken: nextRefresh,
  };
}

export async function rotateSession(refreshToken: string): Promise<SessionCookies> {
  let payload: { sub: string; sid: string };
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new AuthError("INVALID_REFRESH", "Session expired. Please sign in again.");
  }

  const cached = replayFor(refreshToken);
  if (cached) return cached;

  const pending = rotateInFlight.get(payload.sid);
  if (pending) {
    await pending;
    const replayed = replayFor(refreshToken);
    if (replayed) return replayed;
  }

  const work = rotateSessionUnlocked(refreshToken, payload);
  rotateInFlight.set(payload.sid, work);
  try {
    const cookies = await work;
    rememberRotation(refreshToken, cookies);
    return cookies;
  } finally {
    if (rotateInFlight.get(payload.sid) === work) {
      rotateInFlight.delete(payload.sid);
    }
  }
}

export async function revokeSessionByRefresh(refreshToken: string | undefined): Promise<void> {
  if (!refreshToken) return;
  try {
    const payload = verifyRefreshToken(refreshToken);
    await prisma.userSession.updateMany({
      where: { id: payload.sid, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  } catch {
    // already invalid
  }
}

export type PublicUser = {
  id: string;
  email: string | null;
  phone: string | null;
  phoneVerified: boolean;
  displayName: string | null;
  type: AccessTokenPayload["type"];
  status: string;
  permissions: string[];
  organizationId: string | null;
};

export async function toPublicUser(userId: string): Promise<PublicUser> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { orgUsers: true, customer: true },
  });
  if (!user) {
    throw new AuthError("USER_NOT_FOUND", "User not found.", 404);
  }
  return {
    id: user.id,
    email: user.email,
    phone: user.phone,
    phoneVerified: Boolean(user.phoneVerifiedAt),
    displayName: user.displayName,
    type: user.type,
    status: user.status,
    permissions: await loadPermissions(user.id),
    organizationId: user.orgUsers[0]?.organizationId ?? null,
  };
}
