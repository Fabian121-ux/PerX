import { CurrentUser } from "@/lib/auth/session";

export const TEST_SESSION_COOKIE_NAME = "perx_test_session";
export const TEST_SESSION_VALUE = "alex-test-active";

export function isLocalTestUser(currentUser: CurrentUser | null | undefined): boolean {
  if (process.env.NODE_ENV !== "development") return false;
  return currentUser?.username === "alex-test";
}
