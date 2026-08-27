import { purgeFixtureUsers } from "./purge-fixture-users";

/**
 * Give every invocation the same starting state.
 *
 * Without this the suite is order-dependent: a timed-out spec leaves its
 * fixture account behind, that account occupies a beta slot, and an unrelated
 * registration test fails several files later.
 */
export default async function globalSetup() {
  const removed = await purgeFixtureUsers();
  if (removed > 0) {
    console.info(
      `[global-setup] removed ${removed} leftover fixture account(s) from a previous run`,
    );
  }
}
