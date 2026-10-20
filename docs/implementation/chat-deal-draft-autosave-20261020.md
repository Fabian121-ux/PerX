# Chat Deal proposal autosave and safe retry (20 October 2026)

## Improvement
A buyer drafting real terms from the @deal room no longer loses all work when they close the mobile drawer, navigate elsewhere in the chat, or reopen the same Deal proposal on the same browser tab.

- Terms are saved in `sessionStorage` by **current authenticated user + conversation ID**. They do not leave the browser until the user explicitly selects **Submit proposal**.
- Amount, delivery days, included revisions and free-text scope/acceptance criteria are restored on reopening that chat's Deal form.
- A clearly labeled **Discard draft** control clears a local draft without creating or modifying a server proposal.
- A successful server-submitted, immutable proposal clears its browser draft. A failure leaves the text available for retry.
- Crucial idempotency guard: submitting unchanged terms again after a failure keeps the same client request ID. **Changing any field after a failure rotates that ID**, preventing a retry for a previously committed, stale version from being mistaken for acceptance of new terms.
- While submitting, fields and discard are disabled to prevent edits racing a server submission.
- Existing server authorization, moderated listing requirement, deal/version state machine, acceptance flow, account restrictions and no-real-escrow notices are unchanged.

## Safety
- Storage is scoped to a tab and authenticated user. It is not a server draft, shared document, promise of acceptance, or wallet.
- No database migration, new API/storage bucket, background polling, or third-party analytics.
- Malformed or oversized saved drafts fail closed to empty defaults.
- Test coverage for persistence, account/conversation isolation, malformed state, discard, cleared success, duplicate-submit prevention, same-key retry and edited-key rotation.

## Device QA
Open chat Deal terms, enter all fields, close/reopen, validate persistence and account isolation. Try network failure, edit and resubmit, then successful server proposal. Also confirm draft removal and correct version/Deal events.
