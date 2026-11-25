const PTAHX_LOGO_URL = "https://www.ptahx.com/icons/favicon-48x48.png";

export function buildEmailVerificationEmail({
  expiresAt,
  code,
}: {
  expiresAt: Date;
  code: string;
}) {
  const text = [
    "Your PtahX verification code:",
    "",
    code,
    "",
    "Enter this code on the verification page. It expires 5 minutes after it was issued and can only be used once.",
    "If you did not request it, ignore this email.",
  ].join("\n");

  const html = [
    '<div style="margin:0;padding:28px 16px;background:#f4f6fa;font-family:Arial,Helvetica,sans-serif;color:#182230">',
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e5eaf1;border-radius:16px">',
    '<tr><td style="padding:30px">',
    '<div style="display:flex;align-items:center;gap:10px"><img src="' + PTAHX_LOGO_URL + '" width="36" height="36" alt="" style="width:36px;height:36px;border:0"><span style="font-size:20px;font-weight:700">PtahX</span></div>',
    '<h1 style="font-size:26px;margin:24px 0 8px">Verify your email</h1>',
    '<p style="font-size:15px;line-height:1.6;color:#52637a">Copy this code into PtahX to activate your account.</p>',
    '<p style="margin:24px 0;padding:18px;border-radius:12px;background:#f0f4ff;color:#173477;font-size:32px;letter-spacing:9px;text-align:center;font-weight:800;font-family:Arial,Helvetica,sans-serif">' + code + '</p>',
    '<p style="color:#52637a;font-size:13px">Expires in <strong>5 minutes</strong>. The code can only be used once.</p>',
    '<p style="color:#64748b;font-size:12px;margin-top:26px">If you did not request a PtahX account, you can ignore this email.</p>',
    '</td></tr></table></div>',
  ].join("");

  // The timestamp is accepted for transport/testing; TTL is enforced by the
  // token record in PostgreSQL, not by message copy or the client clock.
  void expiresAt;
  return { html, subject: "Your PtahX verification code", text };
}
