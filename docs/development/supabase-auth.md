# Supabase Auth and the PtahX identity bridge

Supabase owns email/password authentication, email confirmation and password
changes. `User.authUserId` is the unique nullable UUID bridge to the provider.
`User.id` remains the existing application cuid/text primary key. Profiles,
roles, capabilities, account enforcement and all resource relationships remain
in PtahX. Email and user-editable provider metadata never select an application
account during authentication.

## Sessions and rollback

The default `PERX_AUTH_PROVIDER=supabase` requires both a verified, online
Supabase `getUser()` result matching `authUserId` and a valid PtahX Session.
The latter is retained as a revocation record so existing account/session
revocation continues to work immediately. A legacy cookie alone grants no
Supabase-mode application access. Supabase cookies are HTTP-only, same-site,
secure in deployed environments, refreshed in the Next.js proxy, and never
returned in client props. Responses carrying refreshed cookies are not cached.

Logout revokes the PtahX session before clearing provider cookies. Recovery
uses a provider-confirmed session plus a short-lived, hashed, one-use PtahX
recovery grant in an HTTP-only cookie. Password updates go to Supabase; PtahX
sessions are revoked before and after the provider update. Cross-system writes
are not claimed to be one transaction. A provider or audit failure reports an
error and requires a new recovery link.

`PERX_AUTH_PROVIDER=legacy` is an explicit operational rollback, not an automatic
fallback. Legacy password hashes, Session and PasswordResetToken tables remain.
Supabase password changes do not update retained legacy hashes. A rollback can
reactivate an old legacy password for an existing user; treat rollback as a
controlled recovery operation, not routine provider failover.
New Supabase-created accounts deliberately have no usable legacy password.
Do not promise those users legacy sign-in after rollback. Cleanup/removal of
legacy password verification and tables belongs in a later migration.

## Signup and partial failure

Form validation, username uniqueness, registration mode and the locked beta
capacity check still execute server-side. A preflight transaction rejects
ineligible requests before contacting Supabase. Supabase then creates an
unconfirmed identity. A second application transaction rechecks eligibility and
creates the UUID link, member role, profile and required audit together.
Neither a submitted user ID nor provider user metadata can assign ownership or
privilege. No application session is created before confirmation.

A provider-success/application-failure outcome is explicitly reported as
incomplete setup. It grants no app access and does not delete a provider user.
An operator must inspect the state, repair any application-side conflict and
link the identity through the controlled tool below. Do not retry by deleting
users or copying a password hash. Confirmation must remain enabled: unexpected
automatic provider confirmation fails closed.

## Dashboard configuration required before cutover

Use the intended Supabase project; preview acceptance should use a separate
non-production project. Do not send real account credentials into a local stack.

- Enable email/password sign-in and **Confirm Email**.
- Set Site URL to the canonical application origin (`https://www.ptahx.com`
  for production). Set `NEXT_PUBLIC_APP_URL` to the same trusted origin.
- Allow the exact `/auth/confirm` URL on that origin, plus explicitly intended
  preview origins. Avoid broad wildcard production redirects.
- A local Supabase stack may allow `http://127.0.0.1:3100/auth/confirm` with
  the matching local application origin. Remote Auth rejects local email
  destinations in application configuration.
- Configure working SMTP, sender identity and appropriate provider rate limits.
  Supabase's default test mail service is not production SMTP acceptance.
- Configure email templates using the token-hash callback below. The default
  fragment-token template is not the server confirmation contract.

Confirmation template link:

```html
<a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&amp;type=signup"
  >Confirm email</a
>
```

Recovery template link:

```html
<a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&amp;type=recovery"
  >Reset password</a
>
```

If invitations are used, configure the equivalent link with `type=invite`.
The application passes `/auth/confirm` as the trusted redirect destination.
The callback validates OTP state, resolves only the UUID bridge, checks account
eligibility and strips tokens from the destination. Recovery goes to
`/reset-password`; normal confirmation uses a validated internal return path.
Never log email bodies, token-bearing URLs or provider payloads.

## Existing account setup

Apply the additive UUID-column migration through the established reviewed
migration process before enabling this code. Never use `prisma db push` on
production. Inspect current application and provider state first.

The operator-only tool defaults to a read-only dry run:

```sh
npx tsx scripts/link-supabase-user.ts --app-user-id=APP_CUID --create-identity
# After verifying the selected record and target configuration:
npx tsx scripts/link-supabase-user.ts --app-user-id=APP_CUID --create-identity --apply
```

For an identity already created during interrupted signup, substitute
`--auth-user-id=PROVIDER_UUID` for `--create-identity`. The script requires
server-only `SUPABASE_SERVICE_ROLE_KEY` and the intended application database
configuration. Never put that key in a public variable or browser. Do not use
this operator tool as a test seed; automated tests must enforce test isolation.

The tool selects an explicit application ID, verifies the provider email against
that operator-selected record, performs a compare-and-set link and audit, revokes
old application sessions and requests a provider password-setup email. It never
copies bcrypt or deletes/recreates the application account. Classification,
roles, profile, messages and related records are preserved. If delivery fails
after linking, fix delivery and use password recovery; do not relink or recreate.

In particular, preserve the existing `dev-test@gmail.com` INTERNAL_ADMIN record.
Complete and verify its password setup before production cutover. There is no
automatic email-based linking during sign-in.

## Verification

`npm run test:authorization` includes the PostgreSQL identity-link tests and the
existing authorization suite. The test-only database guard remains mandatory;
there is no DATABASE_URL fallback. A configured but broken test database fails.
The ordinary unit command skips DB integration only when TEST_DATABASE_URL is
intentionally absent, as documented in authorization-testing.md.

The new browser acceptance requires a dedicated local Supabase stack with email
confirmation enabled, the templates above and a local Mailpit inbox. Configure
ignored `.env.test.local` with guarded TEST_DATABASE_URL/TEST_DIRECT_URL,
NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
NEXT_PUBLIC_APP_URL=http://127.0.0.1:3100, PERX_AUTH_PROVIDER=supabase,
TEST_SUPABASE_SERVICE_ROLE_KEY (local only), and TEST_MAILBOX_URL (loopback only).
The browser test refuses remote provider/mailbox endpoints before fixture writes.

```sh
npx playwright test tests/e2e/supabase-auth.spec.ts --workers=1
```

The test follows real mailbox confirmation/recovery links and verifies actual
provider identities, application UUID links, old-cookie revocation and password
replacement. It runs desktop and 320px layouts. Keep artifacts private: browser
traces and mailbox content may contain short-lived local test credentials.
Legacy auth tests explicitly select rollback mode; this does not test the new
provider flow and must not be described as Supabase runtime acceptance.

## Release prerequisites

Keep PR #15 Draft until the final commit's CI, migration review, preview/browser
acceptance, provider templates/SMTP/redirects and existing-account setup are all
verified. A green schema-only preview does not verify this authentication slice.
Do not switch existing production accounts to Supabase without their UUID links.
