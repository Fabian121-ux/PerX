# Social feed member reporting and blocking — 20 October 2026

This phase continues the user-requested LinkedIn-style feed and safer social
experience. It reuses the existing USER report, personal block and unblock
backend; no new tables, auth changes, permissions or migration.

- Authenticated users see a **More options** menu on posts by other people.
  View profile, Report member, Block member and Manage blocked users are
  functional links/actions, with 44px+ touch targets and readable dark mode.
- Report member leads to `/app/reports/new?targetType=USER&targetId=...`.
  The existing reporting backend validates actual reportable users, creates
  a ModerationCase, and optionally blocks after report.
- Block asks for explicit confirmation and calls the existing server action.
  Button remains pending, duplicate submissions are prevented with a ref,
  a success/error toast is displayed, and the client's visible feed removes
  all posts by that author after successful server acknowledgement.
- Unblock uses the existing participant-owned `/app/settings/blocked` page.
- No menu for your own posts. Guest views remain public-read-only.
- The API feed already filters bidirectional blocks server-side, and paginated
  results remain viewer-scoped. A cursor or cached browser post cannot bypass
  server-level eligibility on new fetches.

**Limitations:** social POST-specific reports are not implemented because
`UserReportTargetType` has no POST target. The action explicitly says
**Report member**. Direct-chat Deal proposals without a published linked
opportunity remain a separately scoped backend/authorization project.
