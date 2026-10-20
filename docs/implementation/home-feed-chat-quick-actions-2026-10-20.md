# Home Feed and Chat Quick Actions — 20 October 2026

The reported "Deal creation is not available in this chat" toast came from
the client checking `dealOffer` before opening the Deal room. The backend
also requires a two-person chat linked to an approved published opportunity
owned by the other participant, plus normal account and proposal permissions.
Removing the client check cannot safely remove those server requirements.

## Changes
- **Every conversation** can now open the `@deal` bottom sheet. Either type
  the full command, tap the @ icon, or tap the compact Make a Deal pill.
  The command is not sent as a chat message.
- Eligible listing chats continue to submit real versioned proposals through
  the existing authorized server action. Unlinked chats see an honest
  explanation and two usable paths: "Ask for a listing" drafts a message to
  the other participant, or "Browse listings" opens discovery. We never
  pretend to create a locked Deal for a chat that the backend rejects.
- Composer includes a **+ attachment menu**. Photos and voice messages are
  visibly disabled and labelled "Coming soon"; this does not silently
  create fake media records or request microphone/camera permissions.
- Existing profile reporting, message reporting, and personal blocks are
  retained. Conversation now has a quick Report link; blocking uses a visible
  pending state, and Manage blocked people links to working Unblock controls.
- Home is a simpler, post-first LinkedIn-style stream. Its giant discovery
  hero is removed, replaced with compact Feed/Explore/People/Tracking
  navigation and a normal post composer.
- Real community posts paginate automatically through a bounded (12 per
  request), viewer-scoped, no-store feed endpoint; merging post IDs prevents
  duplicates. The existing opportunity feed already uses cursor-based infinite
  scroll, so it was left intact. We do **not** endlessly repeat the same data.

## Not implemented
- Standalone chat-native Deal creation without an eligible published listing
  requires a separately designed backend and moderation policy, not a CSS
  change. Real financial escrow and immutable free-form chats are not implied.
- Uploads/voice recordings require storage, security, moderation, retention,
  access controls and mobile-device testing. Marked Coming soon, not fake.
- Full two-user Android chat/keyboard acceptance still needed.
