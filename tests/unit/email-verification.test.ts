import { describe, expect, it } from "vitest";

import {
  createEmailVerificationToken,
  hashEmailVerificationToken,
} from "@/lib/auth/email-verification";
import { buildEmailVerificationEmail } from "@/lib/email/templates/email-verification";

describe("email verification grants", () => {
  it("creates high-entropy URL-safe tokens and stores only a one-way digest", () => {
    const first = createEmailVerificationToken();
    const second = createEmailVerificationToken();

    expect(first).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    expect(second).not.toBe(first);
    expect(hashEmailVerificationToken(first)).toMatch(/^[a-f0-9]{64}$/);
    expect(hashEmailVerificationToken(first)).not.toContain(first);
    expect(hashEmailVerificationToken(first)).toBe(
      hashEmailVerificationToken(first),
    );
  });

  it("builds a plain-text and HTML email with a one-time verification link", () => {
    const verificationUrl =
      "https://www.ptahx.com/verify-email?token=abc123&source=signup";
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const message = buildEmailVerificationEmail({
      expiresAt,
      verificationUrl,
    });

    expect(message.subject).toBe("Verify your PtahX email address");
    expect(message.text).toContain(verificationUrl);
    expect(message.html).toContain("Verify email address");
    expect(message.html).toContain("&amp;source=signup");
    expect(message.html).not.toContain('href="' + verificationUrl + '"');
    expect(message.text).toContain("used once");
  });

  it("escapes user-controlled URL content before rendering HTML", () => {
    const message = buildEmailVerificationEmail({
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      verificationUrl: 'https://www.ptahx.com/verify-email?token="><script>alert(1)</script>',
    });

    expect(message.html).not.toContain("<script>");
    expect(message.html).toContain("&lt;script&gt;");
  });
});
