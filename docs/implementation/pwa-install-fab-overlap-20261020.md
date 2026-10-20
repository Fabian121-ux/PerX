# Install shortcut: never cover reading/typing (20 October 2026)

A follow-up to the draggable circular PWA install shortcut.

- The floating circular install icon now disappears while an input, textarea, select, rich-text editor or textbox has focus. It returns when focus leaves, without discarding the user's chosen position.
- On scroll, it hides immediately and reappears only after a short idle period (850 ms). This helps the Facebook/LinkedIn-style community feed remain readable instead of being covered by the shortcut.
- Resize/soft keyboard/rotation now clamp to the current visible page without **overwriting** the user's saved shortcut coordinates. When the viewport grows back, the preferred saved coordinates return.
- It remains draggable, screen-bound, keyboard repositionable using arrow keys, and one-tap opens the existing honest install dialog.
- No permission, notification, location, telemetry, cookie, schema or deployment configuration changes.

### Coverage and checks
- Unit tests for input + rich-editor focus, scroll hiding, restoration, saved-position handling, accessible launch, keyboard dragging, and viewport clamps.
- Device/browser QA still recommended on Android Chrome, Safari iOS, installed PWA, and desktop Chrome. No screenshot-only test can guarantee that arbitrary third-party overlays never cover text; this reduces the main remaining overlap cases.
