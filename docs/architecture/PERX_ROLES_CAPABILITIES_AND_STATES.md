# PerX Roles, Capabilities, and States Reference

Status: Phase 1B, 2026-08-11. Matches `src/lib/permissions/capabilities.ts` and runtime enforcement code.

## User Roles

| Role | Label | Description |
|------|-------|-------------|
| MASTER_ADMIN | Master Admin | Unrestricted platform administration; holds all capabilities |
| ADMIN | Admin | Platform administration excluding master-only trust/enforcement capabilities |
| FOUNDER | Founder | Can create and update own opportunities |
| CLIENT | Client | Can create/manage opportunities, participate in deals, review |
| FREELANCER | Freelancer | Can create proposals, participate in deals, review |
| INVESTOR | Investor | Can create proposals, participate in conversations |
| PROPERTY_OWNER | Property Owner | Can create/manage opportunities, participate in conversations |
| MEMBER | Member | Base account; no capabilities beyond authentication |
| INTERNAL_TESTER | Internal Tester | Can access internal tester features |

## Role → Capability Mapping

| Capability | Master Admin | Admin | CLIENT | FOUNDER | FREELANCER | INVESTOR | PROPERTY_OWNER | MEMBER | Internal Tester |
|-----------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| `admin:access` | X | X | - | - | - | - | - | - | - |
| `admin:moderate` | X | X | - | - | - | - | - | - | - |
| `appeals:review` | X | - | - | - | - | - | - | - | - |
| `audit:read` | X | X | - | - | - | - | - | - | - |
| `broadcasts:create` | X | X | - | - | - | - | - | - | - |
| `conversation:read:participant` | X | X | X | X | X | X | X | - | - |
| `deal:transition:participant` | X | X | X | - | X | - | - | - | - |
| `deals:review` | X | X | - | - | - | - | - | - | - |
| `deal:view:participant` | X | X | X | - | X | - | - | - | - |
| `enforcement:manage` | X | - | - | - | - | - | - | - | - |
| `internal:tester` | - | - | - | - | - | - | - | - | X |
| `master:admin` | X | - | - | - | - | - | - | - | - |
| `messages:moderate` | X | X | - | - | - | - | - | - | - |
| `opportunity:create` | X | X | X | X | - | - | X | - | - |
| `opportunity:moderate` | X | X | - | - | - | - | - | - | - |
| `opportunity:update:own` | X | X | X | X | - | - | X | - | - |
| `policies:manage` | X | X | - | - | - | - | - | - | - |
| `proposal:create` | X | X | - | - | X | X | - | - | - |
| `proposal:decide:received` | X | X | X | - | - | - | - | - | - |
| `reports:review` | X | X | - | - | - | - | - | - | - |
| `review:create:eligible` | X | X | X | - | X | - | - | - | - |
| `settings:manage` | X | X | - | - | - | - | - | - | - |
| `support:manage` | X | X | - | - | - | - | - | - | - |
| `trust:configure` | X | - | - | - | - | - | - | - | - |
| `trust:read` | X | - | - | - | - | - | - | - | - |
| `trust:recalculate` | X | - | - | - | - | - | - | - | - |
| `trust:review` | X | - | - | - | - | - | - | - | - |
| `users:manage` | X | X | - | - | - | - | - | - | - |
| `users:read` | X | X | - | - | - | - | - | - | - |

## Account States

| State | Database Fields | Effect |
|-------|----------------|--------|
| Active | `isActive: true`, `bannedAt: null`, `deactivatedAt: null`, `suspendedAt: null` | Normal operation |
| Suspended (temporary) | `suspendedAt: Date`, `suspendedUntil: Date` | Access denied until `suspendedUntil` passes |
| Suspended (indefinite) | `suspendedAt: Date`, `suspendedUntil: null` | Access denied until admin restores |
| Banned | `bannedAt: Date` | Permanent access denial |
| Deactivated | `deactivatedAt: Date` | Self-deactivated; can reactivate |
| Restricted (messaging) | `messagingRestrictedUntil: Date` | Cannot send/receive messages |
| Restricted (connections) | `connectionRequestsRestrictedUntil: Date` | Cannot send connection requests |
| Restricted (publishing) | `publishingRestrictedUntil: Date` | Cannot publish opportunities |

## Enforcement Action Types

| Type | Effect |
|------|--------|
| WARNING | Recorded warning; no restriction |
| MESSAGING_RESTRICTION | Sets `messagingRestrictedUntil` |
| CONNECTION_REQUEST_RESTRICTION | Sets `connectionRequestsRestrictedUntil` |
| PUBLISHING_RESTRICTION | Sets `publishingRestrictedUntil` |
| VERIFICATION_REQUIRED | Downgrades verification status |
| TEMPORARY_SUSPENSION | Sets `suspendedAt` + `suspendedUntil` |
| INDEFINITE_SUSPENSION | Sets `suspendedAt` without `suspendedUntil` |
| DEACTIVATION | Forces `deactivatedAt` |
| PERMANENT_BAN | Sets `bannedAt` |
| SESSION_REVOCATION | Deletes all active sessions |
| RESTORATION | Clears all restriction dates |

## Verification States

| State | Description |
|-------|-------------|
| UNVERIFIED | Default; no verification attempted |
| PENDING_VERIFICATION | Verification request submitted |
| VERIFIED | Identity/document verified |
| REJECTED | Verification request denied |

## Deal Participant Roles

| Role | Description |
|------|-------------|
| client | The requesting party |
| provider | The delivering party |

## Proposal/Version States

| State | Description |
|-------|-------------|
| DRAFT | Editable by sender |
| SENT | Submitted, awaiting recipient review |
| ACCEPTED | Accepted → locks version, creates Deal |
| REJECTED | Declined by recipient |
| COUNTERED | Recipient requested changes |
| WITHDRAWN | Sender revoked before acceptance |
| SUPERSEDED | Replaced by a newer accepted version |
| EXPIRED | Past validity window |

## Moderation Case States

| State | Description |
|-------|-------------|
| NEW | Unreviewed report |
| TRIAGED | Initial assessment complete |
| ASSIGNED | Assigned to a moderator |
| IN_REVIEW | Active investigation |
| NEEDS_INFORMATION | Awaiting additional evidence |
| ACTION_REQUIRED | Enforcement decision pending |
| ESCALATED | Requires higher authority |
| RESOLVED | Case resolved |
| DISMISSED | No action needed |
| APPEALED | Under appeal |
| CLOSED | Final disposition |

## Admin Pages → Capability Mapping

| Page | Required Capability | Protected |
|------|-------------------|:---:|
| `/admin` (layout) | `admin:access` | Yes |
| `/admin/deals` | `deals:review` | Yes |
| `/admin/disputes` | `deals:review` | Yes |
| `/admin/users` | `users:read` | Yes |
| `/admin/profiles` | `users:read` | Yes |
| `/admin/moderation` | `admin:moderate` | Yes |
| `/admin/moderation/cases/[id]` | `admin:moderate` | Yes |
| `/admin/messages` | `messages:moderate` | Yes |
| `/admin/reports` | `reports:review` | Yes |
| `/admin/broadcasts` | `broadcasts:create` | Yes |
| `/admin/opportunities` | `opportunity:moderate` | Yes |
| `/admin/real-estate` | `opportunity:moderate` | Yes |
| `/admin/audit-logs` | `audit:read` | Yes |
| `/admin/settings` | `settings:manage` | Yes |
| `/admin/support` | `support:manage` | Yes |
| `/admin/policies` | `policies:manage` | Yes |
| `/admin/verification` | `admin:moderate` | Yes (fixed Phase 1B) |
| `/admin/activity` | `admin:access` | Yes (fixed Phase 1B) |

## Future (B4) Scope

- Server-owned capability grants (replacing role-derived capabilities)
- Admin user detail page (`/admin/users/[id]`)
- Admin deal detail page (`/admin/deals/[id]`)
- Admin deal transition actions
- Admin role assignment/revocation
- User-scoped audit/enforcement history
