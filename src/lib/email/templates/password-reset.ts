/**
 * Password reset message, text and HTML.
 *
 * NO IMAGERY, deliberately. An email client cannot resolve a repository path
 * like `/brand/ptahx-logo-horizontal-light.png`, and the only absolute origin
 * available at runtime is NEXT_PUBLIC_APP_URL - which is the application host,
 * not a guaranteed-public CDN, and is `http://localhost:3000` by default. A
 * hotlinked logo would render as a broken image for most recipients and leak a
 * load-time ping for the rest. A clean text/HTML message is strictly better.
 *
 * The copy never asserts the recipient requested the reset ("a password reset
 * was requested for this account"), because anyone can type someone else's
 * address into the form. It also names no rule, detector or internal mechanism.
 */

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function minutesUntil(expiresAt: Date) {
  const minutes = Math.round((expiresAt.getTime() - Date.now()) / 60_000);
  return minutes > 0 ? minutes : 30;
}

export function buildPasswordResetEmail({
  expiresAt,
  resetUrl,
}: {
  expiresAt: Date;
  resetUrl: string;
}) {
  const minutes = minutesUntil(expiresAt);
  const safeUrl = escapeHtml(resetUrl);

  const text = [
    "A password reset was requested for this PtahX account.",
    "",
    "Choose a new password using the link below:",
    resetUrl,
    "",
    `This link expires in about ${minutes} minutes and can be used once.`,
    "",
    "If you did not request this, you can ignore this message. Your password",
    "stays unchanged unless the link above is used successfully.",
  ].join("\n");

  const html = [
    '<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;line-height:1.6;color:#1f2937">',
    "<p>A password reset was requested for this PtahX account.</p>",
    "<p>Choose a new password using the link below:</p>",
    `<p><a href="${safeUrl}" style="color:#1d4ed8">Reset your password</a></p>`,
    `<p style="font-size:13px;color:#6b7280">Or paste this into your browser:<br>${safeUrl}</p>`,
    `<p>This link expires in about ${minutes} minutes and can be used once.</p>`,
    "<p>If you did not request this, you can ignore this message. Your password stays unchanged unless the link above is used successfully.</p>",
    "</div>",
  ].join("");

  return { html, subject: "Reset your PtahX password", text };
}
