# PreX engineering log

## Task
Make shared server-action submit controls expose a truthful pending state to assistive technology.

## Problem
`PendingSubmitButton` disabled itself and changed its visible label while a form action was pending, but it did not expose `aria-busy`. Core workflows using this shared control therefore had visual pending acknowledgement without an equivalent accessible busy signal.

## Change
Added `aria-busy` while pending and regression coverage that verifies both the busy state and disabled state.

## Proof
The focused Vitest regression covers the shared component. Full repository validation is required through GitHub CI before merge.

## Next candidate
Replace plain notification mutation buttons with the shared pending submit control so Accept/Decline and read-state actions acknowledge latency immediately and resist repeated clicks.
