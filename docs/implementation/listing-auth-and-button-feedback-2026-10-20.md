# Responsive button response and public listing auth (20 October 2026)

The public listing page rendered an unconditional **"Sign in first if
needed"** link even when the user's avatar showed an active session.
The public SiteHeader already reads `getCurrentUser()`, which is request
cached; this patch checks that same session for the listing call-to-action.
Signed-in viewers only see the proposal form, not a misleading sign-in link.
Guests can sign in and return to the specific listing's response section.

## Interaction feedback

- One delegated pointerdown / keyboard listener is registered from the root
  layout, with **no per-card state or extra network request**. Visible
  pressed feedback starts before click navigation or async work completes.
- A 260ms pressed state makes fast taps visible on Android; global CSS adds
  focus-visible outlines and keyboard feedback. All real anchors and buttons
  get feedback, including legacy components. Reduced-motion preferences
  disable scale transforms without disabling colour feedback.
- The existing `PendingSubmitButton` is reused for proposal submission,
  draft saving, bookmarks and reporting on the listing. It displays a clear
  pending label and disables duplicate submits while the action is pending.
- **Do not** globally lock all button clicks: carousel arrows, tabs, message
  composer controls, cancel, etc. are intentionally repeatable. Individual
  asynchronous mutations must remain protected by pending state and
  server-side idempotency/authorization where needed; visual feedback is
  not a substitute for idempotency.
- No new schema, auth implementation, payment, or Supabase changes.

## Validation

- Test authenticated versus guest listing visibility and return URL.
- Test pointerdown/keyboard pressed states, timeout cleanup and disabled
  buttons. Existing pending submit button tests protect duplicate submissions.
- Run lint/typecheck, unit and database-backed tests, production build,
  browser checks at 320/360/390/430px including actual form pending states.
