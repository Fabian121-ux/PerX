# PtahX mobile visual corrections — 20 October 2026

## Evidence from the three user screenshots

1. Messages inbox: selected **Unread** is almost black on near-black. Root
   cause: the global `.bg-white { background: var(--px-surface) !important }`
   remapping changed the selected white pill's background to a dark surface,
   but its intentionally dark navy text stayed dark. Solution: a reusable,
   explicit `ptahx-navy-tab-active/inactive` foreground/background pair
   which works in both themes and during hover. The site's globally aliased
   blue link labels now use `--px-primary-ink` for legibility.
2. Installed PWA floating CTA: wide pill covers **Find people** and the user's
   outgoing message bubbles and keyboard. Solution: a 54-pixel circle, pointer
   draggable, clamped to viewport, keyboard arrows, locally persisted position.
   Hide on Messages/Deal/Escrow and when keyboard or immersive chat is active.
   An installation tap still opens the real PWA dialog. It doesn't silently
   install anything or use Supabase.
3. WhatsApp reference: its conversation has clear date separators, quoted
   replies, incoming/outgoing bubbles, compressed header and bottom composer.
   PtahX already has date separators, reply/quote, read-state, optimistic sends,
   drafts, SSE and a responsive composer. Do not copy WhatsApp's voice calling,
   camera, attachments or end-to-end encryption promises: those require real,
   separately verified backend and privacy/security work.

## Deal room / sub-chat UX (reuse rather than duplicate)
- Typing `@deal` in a conversation with a real Deal/proposal context opens a
  Radix bottom-sheet Deal room, not an ordinary outgoing text message.
- An explicit **Make a Deal · @deal** quick action opens the same sheet.
- Deal room shows existing submitted versions and links to the real locked
  proposal review page or accepted Deal workspace. Its primary CTA opens
  the existing structured terms dialog: amount, deadline, revisions and scope.
- Submitted proposal versions are already server-side immutable; changes
  require a numbered revision, and creating a Deal requires acceptance of
  the exact version. The sheet is *a view of those real records*, not a second
  message database, a payment wallet or a parallel escrow implementation.
- Already-accepted Deal record has a link to its existing workspace. No UI
  button pretends to fund or release real escrow.

## Tests / remaining validation
- Contrast regression checks actual colour ratios > 7:1 for selected tabs and
  the blue idle state, as well as dark-mode CSS pairing.
- Unit tests for FAB viewport bounds, positioning and local keyboard movement.
- Deal drawer tests ensure meaningful locked-record navigation, no fake funds
  and primary action calls the existing form.
- Run lint/typecheck, full unit, PostgreSQL-backed authorization and build CI.
- Manual physical Android verification: PWA dragging does not open dialog,
  tap opens dialog, saved position follows reload, selected inbox filter is
  readable, keyboard never has an overlay, `@deal` opens sheet in an eligible
  chat and locked terms/history work across two distinct participant accounts.
- Stage separately before claiming voice/media uploads, group calls,
  full dedicated Deal sub-chat, E2E encryption, or real escrow custody.
