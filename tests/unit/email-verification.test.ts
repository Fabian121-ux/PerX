import { describe, expect, it } from "vitest";

import {
  createEmailVerificationCode,
  EMAIL_VERIFICATION_CODE_TTL_MINUTES,
  hashEmailVerificationCode,
  isEmailVerificationCode,
  verifyEmailVerificationCode,
  createEmailVerificationToken,
  hashEmailVerificationToken,
} from "@/lib/auth/email-verification";
import { buildEmailVerificationEmail } from "@/lib/email/templates/email-verification";

describe("five-minute email verification codes", () => {
  it("generates six-digit codes (including leading zeros) and accepts only exact numeric input", () => {
    for (let i = 0; i < 40; i++) {
      const code = createEmailVerificationCode();
      expect(code).toMatch(/^\d{6}$/);
      expect(isEmailVerificationCode(code)).toBe(true);
    }
    expect(isEmailVerificationCode("12345")).toBe(false);
    expect(isEmailVerificationCode("1234567")).toBe(false);
    expect(isEmailVerificationCode("12 456")).toBe(false);
    expect(isEmailVerificationCode("12345x")).toBe(false);
    expect(EMAIL_VERIFICATION_CODE_TTL_MINUTES).toBe(5);
  });

  it("stores a slow hash and correctly checks the single-use credential", async () => {
    const code = "012345";
    const digest = await hashEmailVerificationCode(code);
    expect(digest).toMatch(/^\$2[aby]\$/);
    expect(digest).not.toContain(code);
    expect(await verifyEmailVerificationCode(code, digest)).toBe(true);
    expect(await verifyEmailVerificationCode("012346", digest)).toBe(false);
    expect(await verifyEmailVerificationCode(code, "bad hash")).toBe(false);
  });

  it("sends a code, not an activation link, with the stated five-minute lifetime", () => {
    const message = buildEmailVerificationEmail({
      code: "123456",
      expiresAt: new Date(Date.now() + 5 * 60_000),
    });
    expect(message.subject).toBe("Your PtahX verification code");
    expect(message.text).toContain("123456");
    expect(message.html).toContain("123456");
    expect(message.text).toContain("5 minutes");
    expect(message.html).toContain("5 minutes");
    expect(message.html).toContain("https://www.ptahx.com/icons/favicon-48x48.png");
    expect(message.html).not.toContain("verify-email?token=");
    expect(message.text).not.toContain("https://www.ptahx.com/verify-email");
  });

  it("keeps old link digest support during rollout without issuing new links", () => {
    const token = createEmailVerificationToken();
    expect(token.length).toBeGreaterThanOrEqual(40);
    expect(hashEmailVerificationToken(token)).toMatch(/^[a-f0-9]{64}$/);
  });
});
