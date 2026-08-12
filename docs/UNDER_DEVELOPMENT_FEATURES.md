# perX Under Development Features

Interactive controls for unfinished workflows should open the shared Feature Under Development dialog instead of using empty links or silent buttons.

Current examples:

- Voice and video calls in Messages.
- Message attachments.
- Deal tools where no persisted deal exists.
- Advanced filters that require backend persistence.
- Generic feed comments, reactions, post replies, and engagement notifications.
- An authoritative, versioned numeric Trust Score.
- Server-owned capability grants and type-sensitive creation permissions.

Rules:

- Do not use `href="#"`.
- Do not route authenticated users to public sign-in/sign-up navigation.
- Keep `/app` links inside the app shell and `/preview` links inside preview shell.
- Replace dialog placeholders with real server-backed actions as features mature.
