# preX first-run UX, responsive forms and account recovery — 2026-11-11

## Implemented in this branch

- First authenticated visit receives a welcome dialog.
- The welcome dialog offers a lightweight four-step workspace tour or a direct route to Messages.
- The tour can be reopened from a small Guide launcher, and the dismissal is stored on the authenticated user's existing `onboardingDismissedAt` field.
- No fake system chat message is inserted. The welcome is an in-app dialog; Messages is a real navigation destination.
- Form controls and their wrappers are constrained to their parent width. Mobile input/select/textarea font size is at least 16px to avoid iOS Safari focus zoom. Reduced-motion users do not get the guide entrance animation.
- Responsive end-to-end coverage checks for horizontal overflow and touch-control bounds at 320px, 360px and 390px.

## Authentication diagnosis — do not mix providers

The current production code uses a custom database-backed identity model:
- `User.passwordHash` is the password source used by sign-in.
- `Session` is the application's own session store and `ptahx_session` HttpOnly cookie.
- `PasswordResetToken` stores only hashed, single-use reset tokens.
- `passwordRecoveryAction` creates a reset token and dispatches email through the generic transactional email provider.
- `resetPasswordAction` consumes the token, updates `User.passwordHash`, and revokes all sessions.

This is **not Supabase Auth**. Supabase is currently the Postgres host/provider in the Prisma database configuration. Calling Supabase Auth `resetPasswordForEmail` would only reset accounts in Supabase Auth's `auth.users`, not the custom `User.passwordHash` that the current sign-in code checks. A switch to Supabase Auth would require a separate migration of identities, password hashes (where possible), sessions, user metadata and authorization. It must not be mixed into this UI fix.

## Production recovery email prerequisite

The app already supports Resend via:
- `RESEND_API_KEY`
- `EMAIL_FROM`
- `NEXT_PUBLIC_APP_URL=https://www.ptahx.com`

The first two must both be present in Vercel's **Production** environment, and the sender domain must be verified with the email provider. They should also be added to Preview only when preview emails should be delivered. The reset link is built from `NEXT_PUBLIC_APP_URL`, so production must use the canonical domain. Do not commit credentials or paste them into chat.

The current password recovery page intentionally reports that email is not enabled when either provider setting is missing. The token and password-update pipeline exists, but successful inbox delivery has not been verified in this branch.

## Supabase project settings to verify after the owner connects the project

Since the current flow is app-managed, the custom reset endpoint is `https://www.ptahx.com/reset-password`. If/when the app migrates to Supabase Auth, then configure Supabase Auth Site URL to `https://www.ptahx.com` and allow the exact reset callback URL(s). Do not enable a parallel Supabase Auth reset flow until identity ownership is migrated.

## Production gates

- Verify the Supabase Postgres project, pooled `DATABASE_URL`, direct `DIRECT_URL`, backups and current migration status using the connected Supabase project.
- Verify Vercel Production env variable *names and targets* without decrypting secrets.
- Verify sender-domain DNS and test reset email against a controlled test account.
- Run Playwright at phone widths and at least one real iOS/Android device.
- Only promote a deployment after all CI jobs, auth recovery tests, domain routing and smoke checks pass.
