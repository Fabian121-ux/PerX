const PTAHX_LOGO_URL =
  "https://www.ptahx.com/icons/favicon-48x48.png";

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
    "Confirm that this email address belongs to you to activate your account:",
    verificationUrl,
    "",
    `This link expires in about ${hours} hours and can be used once.`,
    "",
    "If you did not create a PtahX account, you can ignore this email.",
  ].join("\n");

  const html = [
    '<div style="margin:0;padding:32px 16px;background:#f4f6fa;font-family:Arial,Helvetica,sans-serif;color:#182230">',
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5eaf1;border-radius:16px">',
    "<tr>",
    '<td style="padding:32px 36px 8px">',
    '<table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>',
    `<td style="vertical-align:middle;padding-right:10px"><img src="${PTAHX_LOGO_URL}" width="36" height="36" alt="" style="display:block;width:36px;height:36px;border:0"></td>`,
    '<td style="vertical-align:middle;font-size:22px;font-weight:700;letter-spacing:-.5px;color:#172033">PtahX</td>',
    "</tr></table>",
    "</td>",
    "</tr>",
    "<tr>",
    '<td style="padding:24px 36px 36px">',
    '<p style="margin:0 0 12px;font-size:12px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:#52637a">Welcome to PtahX</p>',
    '<h1 style="margin:0 0 16px;font-size:28px;line-height:1.2;font-weight:700;color:#172033">Verify your email</h1>',
    '<p style="margin:0 0 24px;font-size:16px;line-height:1.65;color:#465468">Confirm this email address to activate your PtahX account and join the startup ecosystem.</p>',
    `<p style="margin:0 0 24px"><a href="${safeUrl}" style="display:inline-block;padding:14px 22px;border-radius:9px;background:#2457d6;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none">Verify email address</a></p>`,
    `<p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#64748b">Or copy this link into your browser:<br><a href="${safeUrl}" style="color:#2457d6;word-break:break-all">${safeUrl}</a></p>`,
    `<p style="margin:0 0 24px;font-size:13px;line-height:1.6;color:#64748b">For your security, this link expires in about ${hours} hours and can only be used once.</p>`,
    '<hr style="height:1px;border:0;background:#e8edf3;margin:0 0 18px">',
    '<p style="margin:0;font-size:13px;line-height:1.6;color:#64748b">If you did not create a PtahX account, you can ignore this email. Your account will not be activated.</p>',
    "</td>",
    "</tr>",
    "</table>",
    '<p style="margin:18px auto 0;max-width:560px;text-align:center;font-size:12px;color:#8a97a8">PtahX · Building connections across the startup ecosystem</p>',
    "</div>",
  ].join("");

  return {
    html,
    subject: "Verify your PtahX email address",
    text,
  };
}
