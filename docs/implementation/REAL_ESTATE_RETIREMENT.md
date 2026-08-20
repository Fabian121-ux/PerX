# Real Estate retirement

The Real Estate vertical has been removed from the normal PerX member
experience. No user-facing entry point remains.

**No data was deleted.** Existing `PROPERTY` opportunities, their images,
declarations and verification state are intact and still moderatable.

## Removed from the product experience

| Surface | Change |
| --- | --- |
| App sidebar | Feature deleted from `featureRegistry` (`src/lib/navigation/feature-registry.ts`), which also removes it from the feature directory, in-app search (`src/lib/data/search.ts` reads the same registry) and the preview shell |
| `/app/real-estate` | Route deleted; redirects to `/app/discover` |
| `/real-estate` | Redirect retargeted from `/app/real-estate` to `/app/discover` |
| `/preview/real-estate` | Route deleted; redirects to `/preview` |
| Create menu | "Create real-estate listing" item removed (`src/components/dashboard/create-menu.tsx`) |
| Create Post type picker | `PROPERTY` removed from `creatableOpportunityTypeOptions` |
| Category pickers | `real-estate` removed from `opportunityCategoryOptions` |
| Manage filter | Retired types no longer offered as filter values |
| `RouteKey` | `real_estate` removed from `src/lib/navigation/app-routes.ts` |
| Route inventory audit | `/real-estate` removed from `scripts/audit-route-inventory.mjs` |

The redirects are `permanent: false` on purpose. A 308 is cached indefinitely
by browsers, and the destination for retired-vertical links is a product
decision that may change.

## Server-side enforcement

Removing options from a `<select>` is not enforcement. `PROPERTY` /
`real-estate` are refused by the server:

- `createOpportunityAction` rejects any retired type or category outright.
- `updateOpportunityAction` rejects *migrating into* a retired value, but
  permits saving a record that already holds one — otherwise owners could
  never edit or archive their legacy listings.

## Deliberately retained (internal / legacy only)

These are **not** reachable through the normal member experience.

### Data model — unchanged, no migration

| Reference | Location | Why retained |
| --- | --- | --- |
| `OpportunityType.PROPERTY` | `prisma/schema.prisma` | Existing rows use it. Dropping the enum value requires a destructive migration. |
| `UserReportTargetType.REAL_ESTATE_LISTING` | `prisma/schema.prisma:170` | Existing `UserReport` rows use it. Every code path already treats it identically to `OPPORTUNITY`. |
| `PropertyVerificationState` | `prisma/schema.prisma` | Still describes existing listings' review state. |
| `Opportunity.propertyType` / `.propertyListingType` / `.authorityDeclaration` | `prisma/schema.prisma` | Existing listing data. |
| `RoleName.PROPERTY_OWNER` | `prisma/schema.prisma` | Assigned to real accounts; revoking roles is a separate decision. |

### Code kept to serve existing data

| Reference | Location | Why retained |
| --- | --- | --- |
| `retiredOpportunityTypeValues` / `retiredOpportunityCategoryValues` | `src/lib/options.ts` | The retirement list itself. |
| `opportunityTypeOptions` / `allOpportunityCategoryOptions` | `src/lib/options.ts` | Label lookup for existing records. Not selection lists — use `creatableOpportunityTypeOptions` / `opportunityCategoryOptions` for anything a user picks from. |
| `editableOpportunityTypeOptions()` / `editableOpportunityCategoryOptions()` | `src/lib/options.ts` | Edit forms must keep a record's current retired value listed, otherwise saving an unrelated field silently reclassifies the record. |
| `propertyTypeOptions`, `propertyListingTypeOptions` | `src/lib/options.ts` | Still render existing property listings. |
| `defaultOpportunityCategoryByType.PROPERTY` | `src/lib/options.ts` | Keeps the type→category map total. |
| `/admin/real-estate` | `src/app/admin/real-estate/page.tsx` | Admin-only, `opportunity:moderate` gated. Relabelled "Property review (legacy)". Existing listings still need moderation. |
| `REAL_ESTATE_LISTING` handling | `src/features/reports/actions.ts`, `src/features/admin/actions.ts`, `src/lib/admin/moderation-records.ts`, `scripts/audit-moderation-data.mjs` | Legacy reports must stay resolvable. |
| `REAL_ESTATE_LISTING` label | `src/app/app/reports/new/page.tsx` | Relabelled "property listing" so legacy listings stay reportable without naming the vertical. |
| Admin sidebar entry | `src/components/layout/admin-shell.tsx` | Relabelled "Property (legacy)". |

## Follow-up (not done here, requires an explicit decision)

- Deciding what happens to currently-`PUBLISHED` `PROPERTY` listings. They
  remain published and discoverable today. Unpublishing them is a content
  decision affecting real member data.
- Dropping `REAL_ESTATE_LISTING` / `PROPERTY` enum values, which needs a
  destructive migration plus a data backfill.
- Revoking the `PROPERTY_OWNER` role.
