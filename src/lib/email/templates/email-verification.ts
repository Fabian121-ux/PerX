function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function buildEmailVerificationEmail({
  expiresAt,
  verificationUrl,
}: {
  expiresAt: Date;
  verificationUrl: string;
}) {
  const hours = Math.max(
    1,
    Math.ceil((expiresAt.getTime() - Date.now()) / 3_600_000),
  );
  const safeUrl = escapeHtml(verificationUrl);

  const text = [
    "Welcome to PtahX.",
    "",
    "Confirm that this email address belongs to you:",
    verificationUrl,
    "",
    `This link expires in about ${hours} hours and can be used once.`,
    "",
    "If you did not create a PtahX account, you can ignore this email.",
  ].join("\n");

  const html = [
    '<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;line-height:1.6;color:#1f2937">',
    "<p>Welcome to PtahX.</p>",
    "<p>Confirm that this email address belongs to you to activate your account:</p>",
    `<p><a href="${safeUrl}" style="color:#1d4ed8">Verify email address</a></p>`,
    `<p style="font-size:13px;color:#6b7280">Or paste this link into your browser:<br>${safeUrl}</p>`,
    `<p>This link expires in about ${hours} hours and can be used once.</p>`,
    "<p>If you did not create a PtahX account, you can ignore this email.</p>",
    "</div>",
  ].join("");

  return {
    html,
    subject: "Verify your PtahX email address",
    text,
  };
}
