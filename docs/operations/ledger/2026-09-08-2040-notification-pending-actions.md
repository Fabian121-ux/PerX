# Notification mutation pending states

## Task
Make Notifications mutation controls acknowledge in-flight server actions and guard rapid repeat submits.

## Problem
Mark-all-read, connection Accept/Decline, and per-notification read/unread controls used plain submit buttons. They gave no pending feedback and remained clickable while their server action was in flight.

## Change
Route those five mutation surfaces through the existing `PendingSubmitButton`, preserving the same server actions, variants, and authorization boundaries while adding operation-specific pending labels and disabled/busy state.

## Proof
Current `main` reproduced the issue in `src/app/app/notifications/page.tsx`. Added a focused regression test that requires all five mutation surfaces to use the shared pending control. Full PR CI is required before merge.

## Next candidate
Inspect the highest-value remaining core journey for another dead, unacknowledged, or misleading action after this change is validated.
