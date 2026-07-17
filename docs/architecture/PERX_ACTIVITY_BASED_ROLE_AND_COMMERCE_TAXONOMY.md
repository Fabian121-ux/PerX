# perX Activity-Based Role and Commerce Taxonomy

Date: 2026-07-17

## 1. Purpose

This document records the required audit before changing the current role, onboarding, and commerce architecture. It aligns perX with the Founding Office direction:

`Identity -> Activity -> Ecosystem Role -> Connection -> Agreement -> Delivery or Exchange -> Trust Signal -> Reputation`

The implementation must preserve a focused beta. Commodity commerce, payment, escrow, investment custody, property transactions, logistics fulfillment, wallet balances, and financial settlement are not active unless separately implemented and verified.

## 2. Current Role and Capability Architecture

Current authorization uses fixed `RoleName` values in `prisma/schema.prisma`:

- `FREELANCER`
- `CLIENT`
- `FOUNDER`
- `INVESTOR`
- `PROPERTY_OWNER`
- `ADMIN`

`Role` and `UserRole` are authorization-facing tables. `src/lib/permissions/capabilities.ts` maps these role names directly to capabilities such as:

- `admin:access`
- `opportunity:create`
- `proposal:create`
- `proposal:decide:received`
- `deal:view:participant`
- `deal:transition:participant`

Risk: descriptive identity, authorization capability, and activity status are currently coupled. A user-submitted role label can grant non-admin capabilities such as opportunity creation or proposal decisions. `ADMIN` self-grant is filtered in actions, but the broader model still treats role labels as security inputs.

## 3. Current Onboarding Role Dependencies

Fixed-role onboarding is currently present in:

- `src/app/(auth)/sign-up/page.tsx`
- `src/features/auth/actions.ts`
- `src/lib/validation/auth.ts`
- `src/app/app/roles/page.tsx`
- `src/features/roles/actions.ts`
- `src/lib/permissions/capabilities.ts`

The sign-up page asks users to select fixed roles. `signUpAction` validates those roles and creates `UserRole` records after account creation. The role-management page lets signed-in users update non-admin roles. That means users can self-assign roles that currently map to business capabilities.

## 4. Routes and Components Assuming One Fixed Role System

Routes/components with fixed-role assumptions:

- Public sign-up: asks for Freelancer, Client, Founder, Investor, Property Owner.
- `/app/roles`: lets users update security-facing roles.
- Public profile and discovery cards: show role labels as profile identity.
- Preview/demo data: stores roles as strings like Freelancer, Founder, Client.
- Capability checks in opportunity/proposal/deal actions depend on `user.roles`.
- Admin user list and role surfaces present `UserRole` as account role state.

The system supports multiple roles, but they are still fixed, self-declared, and security-bearing.

## 5. Database Tables Affected

Affected current tables:

- `User`
- `Role`
- `UserRole`
- `Profile`
- `Opportunity`
- `Proposal`
- `Deal`
- `DealParticipant`
- `AuditLog`

Recommended new table:

```prisma
model EcosystemRole {
  id         String   @id @default(cuid())
  userId     String
  role       EcosystemRoleName
  sourceType String
  sourceId   String
  status     EcosystemRoleStatus @default(ACTIVE)
  assignedAt DateTime @default(now())
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, role, sourceType, sourceId])
  @@index([userId, role, status])
  @@index([sourceType, sourceId])
}
```

Recommended enums:

```prisma
enum EcosystemRoleName {
  BUSINESS_OPERATOR
  FOUNDER
  JOB_CREATOR
  CLIENT
  WORKER
  PROFESSIONAL
  SELLER
  MERCHANT
  BUYER
  CAPITAL_SEEKER
  INVESTOR
  PARTNER_SEEKER
  PARTNER
  LOGISTICS_PROVIDER
  PROPERTY_OWNER
  PROPERTY_AGENT
}

enum EcosystemRoleStatus {
  ACTIVE
  INACTIVE
  REVOKED
}
```

Authorization should remain separate through capability assignments. A future `CapabilityGrant` table or server-owned role/capability service should replace user-managed `UserRole` for security.

## 6. Migration Risks

- Reusing `Role` for descriptive roles would continue mixing identity and authorization.
- Deleting source records must not silently erase audit history; role rows should become inactive/revoked or remain traceable.
- Migrating current `UserRole` records into ecosystem roles could accidentally preserve self-granted security claims as identity claims.
- Removing sign-up roles without changing `signUpSchema` would break registration.
- Removing role-based capabilities before replacing them would block opportunity/proposal flows.
- A destructive migration would risk existing user, proposal, and deal access.

## 7. Recommended Role-Inference Model

Use activity-derived role assignment:

- Register/manage a business -> `BUSINESS_OPERATOR` or `FOUNDER`
- Post work/request -> `JOB_CREATOR` or `CLIENT`
- Offer skill/service -> `WORKER` or `PROFESSIONAL`
- Publish partnership request -> `PARTNER_SEEKER`
- Join partnership -> `PARTNER`
- List goods -> `SELLER` or `MERCHANT`
- Purchase goods -> `BUYER`
- Publish investment opportunity -> `CAPITAL_SEEKER`
- Participate in investment -> `INVESTOR`

Rules:

- Roles are descriptive and cumulative.
- Every automatic role must include `sourceType` and `sourceId`.
- Role inference must be idempotent.
- Failed activities must not assign roles.
- Descriptive roles must not grant `ADMIN` or privileged capabilities.
- Authorization must check capabilities and ownership, not ecosystem labels.

## 8. Recommended Marketplace and Listing Architecture

Do not force all commerce into the current `Opportunity` model.

Safest staged approach:

1. Keep `Opportunity` for current beta workflows.
2. Introduce a generalized `Listing` model later only after beta routes are stable.
3. Use typed extension tables where workflows diverge:
   - `WorkRequestListing`
   - `ServiceOfferListing`
   - `PartnershipListing`
   - `CommercialGoodListing`
   - `CommodityListing`
   - `InvestmentListing`
   - `PropertyListing`
   - `LogisticsRequestListing`

Recommended taxonomy:

- `OPPORTUNITY`
- `JOB`
- `SERVICE`
- `COMMODITY`
- `COMMERCIAL_GOOD`
- `PARTNERSHIP`
- `INVESTMENT`
- `PROPERTY`
- `LOGISTICS_REQUEST`

Active beta listing types should remain:

- Opportunity
- Work request
- Skill/service offer
- Partnership request

Future-phase or unavailable during beta:

- Commodity checkout
- Commercial goods checkout
- Investment custody
- Property transactions
- Logistics fulfillment
- Real payments
- Real escrow

## 9. What Should Be Implemented Now

Low-risk immediate implementation:

- Remove fixed-role selection from public sign-up.
- Change sign-up validation so account creation requires identity fields only.
- Add an action-oriented post-onboarding screen: find work, offer a skill, hire someone, register business, find partner, post opportunity, explore businesses, buy/sell goods.
- Keep current authorization roles internally until a migration introduces server-owned capability grants.
- Rename public terminology away from permanent identity labels where possible.
- Add `EcosystemRole` schema and migration only after approval and staging database verification.

## 10. What Should Remain Future Phase

- Full `Listing` migration.
- Commodity and commercial goods checkout.
- Real escrow/payment integrations.
- Investment custody.
- Logistics operations.
- Payroll, employment compliance, aviation compliance, and transport fulfillment.
- Automated role inference across every future source type.

## 11. Exact Files Proposed for Modification

Low-risk role-free onboarding:

- `src/app/(auth)/sign-up/page.tsx`
- `src/features/auth/actions.ts`
- `src/lib/validation/auth.ts`
- `tests/unit/auth-actions.test.ts`
- `tests/e2e/primary-flow.spec.ts`

Role architecture after approval:

- `prisma/schema.prisma`
- `prisma/migrations/*`
- `src/lib/permissions/capabilities.ts`
- `src/features/roles/actions.ts`
- `src/app/app/roles/page.tsx`
- `src/lib/auth/session.ts`
- `tests/unit/permissions.test.ts` or new unit tests

Terminology/navigation:

- `src/lib/navigation/sidebar-items.ts`
- `src/lib/navigation/app-routes.ts`
- `src/components/discover/discover-experience.tsx`
- `src/lib/data/static-pages.ts`
- `src/lib/data/demo.ts`
- `src/lib/data/preview.ts`

## 12. Implementation Status in This Pass

Implemented now:

- Documentation of the required audit and target architecture.
- Static public copy now describes roles as activity-derived and cumulative.
- No Prisma schema migration was performed.
- No destructive migration was run.
- No production or staging data was modified.

Not implemented pending approval:

- New `EcosystemRole` table.
- Role-free sign-up form.
- Activity inference service.
- Route consolidation.
- Marketplace listing migration.
