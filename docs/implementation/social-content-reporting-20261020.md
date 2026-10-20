# Content-specific social reports and safer comments — 20 October 2026

## What changed
- Every eligible community post now offers **Report post** alongside **Report member**, Block and Manage blocked members.
- Comments include **Report comment**, **Report member**, and the same block/unblock paths. Blocking hides all visible comments from that member immediately after the server confirms success, and Next.js refreshes the server-scoped result.
- Every comment now has a stable deep link (`/posts/<postId>#comment-<commentId>`), making legitimate discussion and moderation references shareable.
- Reuses existing `UserReportTargetType.OTHER_CONTENT` for exact `POST:<id>` and `COMMENT:<id>` report targets—no new tables, migrations, service keys, or role changes.
- Report service **resolves exact content** using the existing published/approved/undeleted author and bidirectional-block filters, rejects self-reports and forged IDs, and sets the actual author as the reported user.
- Case records keep a server-derived original-content URL, and an admin-only case detail view can inspect post/comment content even after moderation hides it (if it still exists in the DB).
- Users may optionally report-and-block content authors through the existing transactional block path.

## Security and boundaries
- `OTHER_CONTENT` is accepted **only** for the two typed social prefixes. All other target kinds are refused.
- Reporting by guessed IDs cannot bypass visibility or account block restrictions.
- Guests can view public comments and copy their links but cannot see report or block controls.
- Own comments retain Edit/Delete, without allowing reporting or blocking oneself.
- No synthetic moderation case, POST enum addition, payment flow, or upload is introduced.
- For comment reports, moderators follow a real post + comment anchor; admins can inspect even if the public page no longer shows flagged content.

## Remaining work
- End-to-end mobile QA on two real accounts, including audit trail and staff review flows.
- Standalone Deals without a published listing and secure image/voice uploads remain separate backend work.
