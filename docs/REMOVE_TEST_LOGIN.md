# Test Account and Demo Safety

The local Test Account and Preview Mode are intended for database-free product review and development.

## Production Rules

- Do not expose unrestricted admin access through demo or test flows.
- Do not bypass server-side authentication or authorization.
- Do not store real passwords or secrets in frontend code.
- Keep production demo/test controls gated by explicit environment settings.
- Test Account and Preview Mode data must remain fictional.

## Verification

Before production deployment, confirm:

- Test/demo controls are disabled unless explicitly enabled.
- Demo users cannot alter security settings, passwords or shared demo records.
- Admin preview is restricted and non-destructive.
- Private app, admin, message and deal routes are not cached by the service worker.
