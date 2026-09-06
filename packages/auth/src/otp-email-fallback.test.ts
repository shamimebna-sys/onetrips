import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { hashOtp } from "./crypto";

const enqueueNotification = vi.fn();
const otpChallengeCreate = vi.fn();
const otpChallengeFindFirst = vi.fn();
const otpChallengeUpdate = vi.fn();
const generateOtpCode = vi.fn();

vi.mock("@onetrips/notifications", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@onetrips/notifications")>();
  return {
    ...actual,
    enqueueNotification: (...args: unknown[]) => enqueueNotification(...args),
  };
});

vi.mock("@onetrips/database", () => ({
  prisma: {
    otpChallenge: {
      create: (...args: unknown[]) => otpChallengeCreate(...args),
      findFirst: (...args: unknown[]) => otpChallengeFindFirst(...args),
      update: (...args: unknown[]) => otpChallengeUpdate(...args),
    },
  },
}));

vi.mock("./crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./crypto")>();
  return {
    ...actual,
    generateOtpCode: (...args: unknown[]) => generateOtpCode(...args),
  };
});

vi.mock("./rate-limit", () => ({
  consumeRateLimit: vi.fn().mockResolvedValue({ ok: true, retryAfterSec: 0 }),
  RATE_LIMITS: {
    otp: { limit: 20, windowMs: 600_000 },
    register: { limit: 10, windowMs: 600_000 },
  },
}));

const { issueOtp, requestOtp, verifyOtp, consumeOtp } = await import("./service");

const EMAIL = "ada@example.com";

function challenge(overrides: Record<string, unknown> = {}) {
  return {
    id: "otp-1",
    destination: EMAIL,
    channel: "EMAIL",
    purpose: "REGISTER",
    codeHash: hashOtp("000000", EMAIL),
    attempts: 0,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    consumedAt: null,
    createdAt: new Date(),
    ...overrides,
  };
}

describe("email verification OTP fallback", () => {
  const originalHost = process.env.SMTP_HOST;

  beforeEach(() => {
    enqueueNotification.mockReset();
    enqueueNotification.mockResolvedValue({ logId: "log-1", queued: false, sent: true });
    otpChallengeCreate.mockReset();
    otpChallengeCreate.mockResolvedValue({ id: "otp-1" });
    otpChallengeFindFirst.mockReset();
    otpChallengeUpdate.mockReset();
    otpChallengeUpdate.mockResolvedValue({ id: "otp-1" });
    generateOtpCode.mockReset();
    generateOtpCode.mockReturnValue("482913");
  });

  afterEach(() => {
    if (originalHost === undefined) delete process.env.SMTP_HOST;
    else process.env.SMTP_HOST = originalHost;
  });

  describe("email not configured", () => {
    beforeEach(() => {
      delete process.env.SMTP_HOST;
    });

    it("stores OTP 000000 and does not send email", async () => {
      await issueOtp({ destination: EMAIL, channel: "EMAIL", purpose: "REGISTER" });

      expect(generateOtpCode).not.toHaveBeenCalled();
      expect(enqueueNotification).not.toHaveBeenCalled();
      expect(otpChallengeCreate).toHaveBeenCalledWith({
        data: {
          destination: EMAIL,
          channel: "EMAIL",
          purpose: "REGISTER",
          codeHash: hashOtp("000000", EMAIL),
          expiresAt: expect.any(Date),
        },
      });
    });

    it("accepts 000000 through the normal verification flow", async () => {
      otpChallengeFindFirst.mockResolvedValue(challenge());

      const result = await verifyOtp(
        { destination: EMAIL, purpose: "RESET", code: "000000" },
        {},
      );

      expect(result.status).toBe(200);
      expect(result.body.message).toBe("Code verified.");
      expect(otpChallengeUpdate).toHaveBeenCalledWith({
        where: { id: "otp-1" },
        data: { consumedAt: expect.any(Date) },
      });
    });

    it("resend stores OTP 000000 and does not send email", async () => {
      const result = await requestOtp({
        destination: EMAIL,
        channel: "EMAIL",
        purpose: "REGISTER",
      });

      expect(result.status).toBe(200);
      expect(generateOtpCode).not.toHaveBeenCalled();
      expect(enqueueNotification).not.toHaveBeenCalled();
      expect(otpChallengeCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          codeHash: hashOtp("000000", EMAIL),
          purpose: "REGISTER",
        }),
      });
    });
  });

  describe("email configured", () => {
    beforeEach(() => {
      process.env.SMTP_HOST = "smtp.example.com";
    });

    it("keeps random OTP generation and sends email", async () => {
      await issueOtp({ destination: EMAIL, channel: "EMAIL", purpose: "REGISTER" });

      expect(generateOtpCode).toHaveBeenCalledOnce();
      expect(enqueueNotification).toHaveBeenCalledWith({
        channel: "EMAIL",
        recipient: EMAIL,
        template: "OTP",
        payload: { code: "482913", purpose: "REGISTER" },
      });
      expect(otpChallengeCreate).toHaveBeenCalledWith({
        data: {
          destination: EMAIL,
          channel: "EMAIL",
          purpose: "REGISTER",
          codeHash: hashOtp("482913", EMAIL),
          expiresAt: expect.any(Date),
        },
      });
    });

    it("accepts the generated OTP through the normal verification flow", async () => {
      otpChallengeFindFirst.mockResolvedValue(
        challenge({ codeHash: hashOtp("482913", EMAIL) }),
      );

      const result = await verifyOtp(
        { destination: EMAIL, purpose: "RESET", code: "482913" },
        {},
      );

      expect(result.status).toBe(200);
      expect(result.body.message).toBe("Code verified.");
    });

    it("resend uses the existing random OTP and sends email", async () => {
      const result = await requestOtp({
        destination: EMAIL,
        channel: "EMAIL",
        purpose: "REGISTER",
      });

      expect(result.status).toBe(200);
      expect(generateOtpCode).toHaveBeenCalledOnce();
      expect(enqueueNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: { code: "482913", purpose: "REGISTER" },
        }),
      );
    });
  });

  describe("verification failures", () => {
    beforeEach(() => {
      delete process.env.SMTP_HOST;
    });

    it("rejects an incorrect OTP", async () => {
      otpChallengeFindFirst.mockResolvedValue(challenge());

      const result = await verifyOtp(
        { destination: EMAIL, purpose: "REGISTER", code: "123456" },
        {},
      );

      expect(result.status).toBe(401);
      expect(result.body.code).toBe("OTP_INVALID");
      expect(otpChallengeUpdate).toHaveBeenCalledWith({
        where: { id: "otp-1" },
        data: { attempts: { increment: 1 } },
      });
    });

    it("rejects an expired OTP", async () => {
      otpChallengeFindFirst.mockResolvedValue(
        challenge({ expiresAt: new Date(Date.now() - 1000) }),
      );

      const result = await verifyOtp(
        { destination: EMAIL, purpose: "REGISTER", code: "000000" },
        {},
      );

      expect(result.status).toBe(401);
      expect(result.body.code).toBe("OTP_INVALID");
      expect(otpChallengeUpdate).not.toHaveBeenCalled();
    });

    it("consumeOtp still rejects a wrong code when the fallback is active", async () => {
      otpChallengeFindFirst.mockResolvedValue(challenge());

      await expect(consumeOtp(EMAIL, "REGISTER", "123456")).rejects.toMatchObject({
        code: "OTP_INVALID",
      });
    });
  });
});
