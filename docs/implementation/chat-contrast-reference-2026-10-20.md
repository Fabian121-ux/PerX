# Mobile chat reference and dark-mode contrast fixes (20 October 2026)

## Based on the two supplied mobile screenshots

The live Home screenshot shows a nearly invisible **Explore all** pill in
dark mode. The supplied messaging screenshot shows a compact navy Messages
inbox with readable search, filter buttons, conversation previews and an
easily understandable chat layout.

## Changes (frontend only)

- Scope an explicit high-contrast white/dark-navy pair to the "Explore all"
  discovery chip, including hover and dark mode. The text/background pair
  cannot be overridden by the application's generic dark palette.
- Increase the contrast of global muted text in both light and dark mode.
  Restore semantic emerald success colours (previously globally recoloured
  purple), which also caused misleading state indications.
- Improve Home composer contrast, hover state and mobile tap targets.
- Make the existing **Messages** inbox navy header, search placeholder, filters,
  unread badge, time and message preview easier to read on narrow screens.
- Preserve original unread counts, filters, and server-backed message system.
  Archived messages are not backed by a completed archive feature, so do not
  add a fake Archived filter.
- Make the existing **Make a Deal** action use the actual proposal dialog,
  and keep existing Deal record and agreement tracking links.
- Improve the safety notice's legibility. Do not repeat the screenshot's
  unsupported end-to-end-encryption, audio/video calls, or media attachments.
  PtahX does not currently deliver those functionalities.
- Do not change database migrations, messaging auth, realtime SSE, drafts,
  messages or driver GPS logistics in this UI-only PR.

## Regression checks

- New theme-contrast regression tests check WCAG 4.5:1 for muted foreground
  versus card surface and 7:1 for key on-surface text/chip pairs.
- Existing message workspace test asserts functional Make a Deal action,
  honest notice, and readable search placeholder.
- New Playwright mobile check tests computed CSS before and during hover,
  then opens the real Explore all destination.
- Run lint, typecheck, unit + DB-backed authorization tests, Next build,
  Playwright mobile widths (320/360/390/430px), and inspect both themes on
  physical mobile browsers prior to claiming fully validated appearance.

## Release boundary

This branch is independent of the pending Logistics V1 schema migration in
draft PR #22. No Supabase or authentication changes, no runtime feature flags.
