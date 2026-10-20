# Make a Deal from an ordinary conversation — approved-listing picker

October 20, 2026. This is a safe incremental path toward chat-native Deals.

## New end-to-end path
1. Open any regular two-person active chat and tap @ or Make a Deal.
2. The Deal drawer now looks up approved, published listings **owned by that specific chat partner**. It does not suggest other users' listings.
3. Selecting a listing performs a server-authorized, transactional link to the existing conversation. It checks active user capability, fresh session, account restrictions, participant membership, both-way blocks, listing ownership/moderation/publication, and absence of previous proposals. The same per-conversation advisory lock as proposal submission avoids race conditions.
4. When the server confirms the link, the existing **versioned proposal form** opens immediately; the next submission uses the established immutable-proposal, acceptance, Deal record and milestone workflow.
5. If no eligible listing exists, the original **Ask for a listing** and **Browse listings** options remain available.

## Safety constraints
- Cannot retarget a conversation already linked to another listing or with proposal history.
- Does not create an unapproved listing, synthetic Deal or escrow; does not alter DB schemas or financial state.
- Real Deal proposal only works with an approved listing owned by the other chat participant; standalone listing-free Deals remain a separate architecture project.
- Client offerings are only discoverability UI. All access and moderation predicates are freshly checked again in the link transaction and later in actual proposal submission.
- No credentials, media storage or payment changes.
- Unit coverage for picker loading/linking/rejections and backend member/owner/block/session/retarget checks.

## Remaining validation
- CI lint/types/unit/PostgreSQL checks.
- Two real accounts: ordinary chat → listing selection → submitted proposal → acceptance → Deal workspace, including revocation/block/moderation races.
- Mobile drawer + focus/keyboard validation.
