# Removing Local Test Login

Before launching the real application, you may want to completely remove the database-free local test login feature to reduce bundle size and maintenance overhead.

Follow these steps to safely remove the test login system:

## 1. Delete Test Modules
Delete the following files completely:
- `src/lib/dev/test-auth.ts`
- `src/lib/data/test-account.ts`
- `src/lib/data/test-data-adapter.ts`
- `src/features/auth/test-login-action.ts`
- `src/features/auth/test-logout-action.ts`
- `src/components/test-account-button.tsx`

## 2. Remove Test Cookie Checks from Authentication
In `src/lib/auth/session.ts`:
- Remove imports for `TEST_SESSION_COOKIE_NAME`, `TEST_SESSION_VALUE`, and `testUser`.
- Remove the development environment check for the test cookie inside `getCurrentUser()`.

## 3. Remove Data Adapter Interceptors
In the following files, remove the `isLocalTestUser` checks and the corresponding `test-data-adapter` imports:
- `src/lib/data/app.ts`
- `src/lib/data/opportunities.ts`

## 4. Remove Action Interceptors
In the following files, remove the `isLocalTestUser` checks that redirect or bypass database operations:
- `src/features/opportunities/actions.ts`
- `src/features/proposals/actions.ts`
- `src/features/deals/actions.ts`
- `src/features/profiles/actions.ts`
- `src/features/roles/actions.ts`

## 5. Remove Test UI Elements
In `src/app/(auth)/sign-in/page.tsx`:
- Remove the `TestAccountButton` import and conditional rendering block.
- (Optional) Remove the brief descriptions below the preview button if no longer desired.

In `src/components/layout/app-shell.tsx`:
- Remove the `isLocalTestUser` and `testLogoutAction` imports.
- Remove the conditional "Test Account" badge.
- Revert the `<form>` action back to strictly use `signOutAction` and revert the button text back to `"Sign out"`.

## 6. Verify Deletion
Run `npm run type-check` and `npm run build` to ensure no dangling test-login references remain in the codebase.
