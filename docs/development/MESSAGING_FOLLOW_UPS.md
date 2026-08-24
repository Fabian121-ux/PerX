# Messaging Follow-Ups

Status: recorded 2026-08-24, during Batch 4.

Findings from the Batch 4 messaging audit that were deliberately **not** fixed
in this pass. Each was verified against source; line references are to the
state of the tree when this was written.

## 1. The events stream is polling in disguise

`src/app/api/messages/events/route.ts:205` runs `setInterval(sendSnapshot, 2000)`.
Each tick calls `getMessageSnapshot`, whose `conversationSnapshotInclude` loads
eleven relations, and a tick that also refreshes the conversation list pays that
set twice (`snapshot.ts:58-61`).

Measured with `scripts/messaging-stream-audit.mjs` against the local test
database:

```
~426 queries/minute per connected client (~25,560/hour)
   10 concurrent ->   ~4,260 q/min  (~71 q/s)
  100 concurrent ->  ~42,600 q/min  (~710 q/s)
1,000 concurrent -> ~426,000 q/min  (~7,100 q/s)
```

Batch 4 reduced this by closing the stream on hidden tabs, which removes the
cost of background tabs but not the per-tick cost of foreground ones.

Directions worth evaluating, cheapest first:

- gate the snapshot on a cheap change probe (max `Message.createdAt` and
  `Conversation.updatedAt` for the participant) so an idle conversation costs
  one small query per tick rather than eleven joins
- widen `streamIntervalMs` and rely on the mutation cursor for correctness
- emit a `retry:` field so reconnect backoff is server-controlled; the browser
  default (~3 s) currently applies with no jitter
- replace polling with `LISTEN`/`NOTIFY` or a hosted realtime channel

## 2. No unread divider, and the data for it is discarded

`readByCurrentUser` is computed server-side (`snapshot.ts:203-208`) but is not
part of `WorkspaceMessage` and is referenced nowhere in `src/`. It reaches the
wire and is dropped.

The only in-timeline separator is `DateSeparator` - a calendar-day rule, not an
unread marker. There is no "New messages" line and no scroll-to-first-unread.

## 3. Jump-to-latest count is invisible to sighted users

`newMessageCount` is maintained correctly and reaches the DOM only through an
`aria-label` and an `sr-only` live region. The button's visible content is a
bare `ArrowDown`. A sighted user cannot tell one new message from twelve.

## 4. Keyboard inset is computed but never applied to the composer

`SoftwareKeyboardProvider` measures the keyboard and publishes
`data-perx-keyboard="open"` plus `--px-keyboard-inset` on `<html>`. Only
`authenticated-mobile-nav.tsx` consumes it. No rule in `globals.css` targets
`.message-workspace` or `.message-composer`.

On iOS Safari, which overlays the keyboard rather than resizing the viewport,
`100dvh` does not shrink and the composer is occluded. The provider already
computes the correct inset for exactly this case; it is simply not used here.

## 5. Whole-workspace re-render on every tick

The entire snapshot lives in one `useState`, and
`mergeWorkspaceConversationSnapshots` always returns fresh array and object
identities with no equality bail-out. Every tick invalidates the
`visibleConversations`, `messages`, and `timeline` memos, re-sorts the timeline
(allocating a `Date` per comparison), and re-renders every bubble.

`React.memo` is used zero times in the file, and most bubble handlers are
re-allocated on each render, so adding it alone would not help - the handlers
would need stabilising first.

Because the server force-emits a snapshot every 10 s regardless of change, this
is a guaranteed full re-render every 10 s in a completely idle conversation.

## 6. Component size

`message-workspace.tsx` is ~4,000 lines with roughly 30 state slots and a dozen
effects in a single function body. A split into list / thread / composer /
transport was considered and deliberately deferred: it is a large diff with real
regression risk and no user-visible benefit. Worth doing once messaging
behaviour has settled, and worth pairing with item 5.

## Unrelated: a pre-existing E2E failure

`tests/e2e/authenticated-acceptance.spec.ts:1867` fails with a strict-mode
violation - `getByText("Trust workflow platform")` resolves to two elements.
Reproduced identically on an unmodified tree, so it is not a Batch 4
regression. The cause is accumulated fixture data in the shared test database
creating a duplicate portfolio entry, not a defect in application code. The fix
is either a scoped locator or fixture cleanup.
