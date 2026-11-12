# Email verification for public registration

**Implemented:** 2026-11-12  
**Authentication store:** Prisma `User` and `Session` (Supabase Auth migration is not part of this change).

## Registration flow

1. The registration action checks registration capacity and rejects duplicate email/username values.
2. In production, it refuses to create a public account until a real outbound email provider is configured.
3. The account and its 24-hour verification-token digest are created in one database transaction. The raw token is never stored.
4. No app session is issued at registration. The user is sent to `/verify-email` and must confirm the address before they can sign in.
5. The email opens a confirmation page. The user must press **Verify email address** to consume the grant. Merely opening the email link does not consume it, which protects against link-prefetching scanners.
6. The grant is consumed atomically. The matching account is marked `emailVerifiedAt` and `verificationStatus=VERIFIED`, then the user is sent to sign-in.

## Recovery and abuse controls

- Verification grants are SHA-256 hashed before storage, single-use, and expire after 24 hours.
- A resend request is limited to three per account in a rolling 30-minute window.
- Resend responses do not disclose whether an email address belongs to an account.
- Previous unused grants are retired when a fresh link is issued.
- Public accounts without verified email are denied sign-in.
- The existing internal administrator classification is exempted from the new sign-in check so the existing admin account and password remain usable.
- Delivery logs contain provider/status/reason metadata only. They never include email addresses, verification links, or raw tokens.
- Local development uses the existing console provider. Production does not treat a console log as successful delivery.

## Production configuration required

The existing email-provider abstraction currently selects Resend only when both of these server-side Vercel variables are present:

- `RESEND_API_KEY` — secret API key; set as encrypted/sensitive in Vercel and never expose it to the browser.
- `EMAIL_FROM` — a verified sender such as `PtahX <hello@ptahx.com>`.

The production app origin must be:

- `NEXT_PUBLIC_APP_URL=https://www.ptahx.com`

The sender domain must be verified with the email provider and its requested DNS records published (SPF and DKIM; DMARC is recommended). Configure the values for both Production and Preview, then create a new deployment so the runtime receives them.

**Observed Vercel configuration at implementation time:** the project had neither `RESEND_API_KEY` nor `EMAIL_FROM`. Therefore Production verification delivery is not yet live. With the current guard, public registration returns a clear temporary-unavailable error instead of creating an account that cannot receive its verification link.

## Existing administrator protection

The existing administrator is still held in the Prisma `User` table, with the existing password hash and sessions. This change does not migrate the admin to `auth.users`, change the password hash, revoke sessions, or require that account to re-register. The admin is exempt from the new public-account email-verification sign-in requirement.

## Scope boundary

This implements email verification within the app's current Prisma-backed authentication system, reusing the repo's transactional email provider interface. It does **not** complete the previously discussed migration of authentication to Supabase Auth, configure Supabase Auth SMTP, or change the password/session store. Those are separate changes requiring a verified SMTP sender and a deliberate migration plan for the existing administrator.
