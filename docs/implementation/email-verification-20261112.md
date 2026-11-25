# Email verification for PtahX public accounts

**Original implementation:** 2026-11-12  
**Code-based UX updated:** 2026-11-25  
**Authentication:** Next.js server actions, Prisma User + Session, PostgreSQL on Supabase (not Supabase Auth).

## User experience

1. New users create accounts with name, username, email, password, and terms acceptance.
2. The server creates a pending user and a single-use **six-digit code** whose database expiry is **five minutes** after issuance. No session is issued yet.
3. Resend emails contain the numeric code only—never an activation URL.
4. The user is redirected to `/verify-email?status=sent&email=...`. This is a compact form: email (prefilled), code input, one primary **Verify and continue** button. The secondary resend control is collapsed.
5. On successful verification, the server consumes the code and marks the user verified in one transaction; then it creates the session and redirects directly to `/app`.
6. When an unverified user enters valid sign-in credentials, the app opens the code page, issuing a new code if there isn't already a valid one. Existing verified accounts and internal admins keep normal password sign-in.

## Security and abuse controls

- Each code is cryptographically generated via `crypto.randomInt` and stored **only as a bcrypt hash**, not plaintext.
- The email and submitted code are required together. Codes are single-use and expire at the PostgreSQL `expiresAt` timestamp after five minutes.
- **Five verification guesses per account per rolling five-minute window**. Failed guesses are counted as redacted `AuditLog` records; no plaintext codes, email content, or tokens in logs.
- Per-account PostgreSQL transaction advisory locks serialize verification attempts, preventing parallel guesses from bypassing the per-account attempt limit. They also serialize issuance/rate-limit decisions.
- At most **six generated verification codes per account per 30-minute window**; this includes the original signup code.
- Explicit resends invalidate older pending codes; repeated sign-ins do **not** replace still-active codes.
- Unknown addresses receive neutral resend responses, avoiding account-existence disclosures.
- Existing unexpired 24-hour email links issued before the rollout retain server-side legacy redemption temporarily; no new links are sent. Remove that handler after all old grants have expired.
- `createSession` is called only after the account's email has been marked verified; session and account enforcement checks still apply.
- Browser/regression tests must use a disposable loopback database; no production user or email mutations.

## Delivery and operations

- Production signup is blocked if Resend email delivery isn't configured.
- `RESEND_API_KEY` is server-only. The verified sender identity is `PtahX <hello@ptahx.com>`.
- Sending occurs via Next.js `after()`, outside the visible request; delivery provider failures are logged only as safe provider/status metadata.
- The user can request a new code in the collapsed **Didn't receive a code?** panel; resend is intentionally rate-limited.
- E2E acceptance should prove: six-digit entry, five-minute expiry, successful session redirect, replay blocked, rejected expired code, and behavior on narrow screens.
- This does **not** add a second factor for every established user login. The code verifies unverified account email ownership; existing verified members sign in using their password.

## Compatibility

The Prisma schema and `EmailVerificationToken` table remain unchanged; `tokenHash` stores bcrypt hashes for newly issued numeric codes and legacy SHA-256 hashes only for grants issued before the rollout. No data migration required.
