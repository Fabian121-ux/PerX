# PtahX install PWA reminder and Deal pipeline review — 20 October 2026

## User experience

- An eligible non-installed visitor on Home/Discover sees an install suggestion
  after 8 seconds, never immediately on first paint. Only once per **7 days**
  on this browser. This uses `localStorage`, not Supabase or cookies.
- Dismissing the suggestion leaves a small **Install app** floating pill above
  the five-tab navigation; tapping it reopens the install dialog at any time.
- `beforeinstallprompt` is required for a real native installation request.
  The prompt is single-use and guarded against double taps.
- iOS does not expose a standard native installation prompt: the dialog
  explains Safari → Share → Add to Home Screen. Android without install
  eligibility shows browser-menu instructions instead of pretending it can
  install automatically.
- Installed standalone sessions see neither the popup nor the floating icon.
  The `appinstalled` event clears both immediately.
- Popup does not auto-open in messages, Deal workspaces, admin or forms.
  Native install/updates remain separate controls. Users can dismiss.
- No downloads, permissions, background polling, or PWA interaction telemetry
  are triggered by the reminder.

## Deal agreement / simulated escrow hardening

- Agreement overview is **bounded to 30 latest rows**, scoped to authorized
  participants. The query selects just fields rendered, not full deal trees.
- No false claims of held money in headings, pills, empty states or the Deal
  agreement timeline. Funded/Released statuses are explicitly simulated.
- Agreement details have a readable timeline and accessible, dark-safe styles.
- Chat → Make a Deal retains the real conversation proposal flow; a synchronous
  ref lock prevents instant double-submits before React's pending state paints.
  Its idempotency key resets after a successful submission; failed retries can
  keep the same key. No paid wallet or simulated financial activity is enabled.

## Tests and release boundary

- Unit policy: cooldown, standalone, supported platform detection, home-only
  auto nudge, no prompts in chat/offline.
- UI: delayed modal, floating affordance, manual re-open, native prompt one-time,
  hide on installed event. Add browser/device acceptance for Safari iOS,
  Android Chrome, desktop Chromium and PWA standalone.
- Deal audit tests: exact participant scope, 30-record bounded query and
  explicit no-real-funds wording. Existing messaging and escrow state-machine
  tests remain active in CI with Postgres authorization suite.
- No Prisma migration, new paid service, escrow funds, payment integration,
  PWA cache relaxation, or Supabase changes.
- CI does not replace manual installability QA or real bank/payments testing.
