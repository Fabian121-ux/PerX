import { purgeFixtureUsers } from "./purge-fixture-users";

/**
 * Give every invocation the same starting state.
 *
 * Without this the suite is order-dependent: a timed-out spec leaves its
 * fixture account behind, that account occupies a beta slot, and an unrelated
 * registration test fails several files later.
 */
export default async function globalSetup() {
  try {
    const removed = await purgeFixtureUsers();
    if (removed > 0) {
      console.info(
        `[global-setup] removed ${removed} leftover fixture account(s) from a previous run`,
      );
    }
  } catch (error) {
    // Hygiene, not a gate. If the database is unreachable the specs themselves
    // report that clearly; failing here instead would mask the real cause
    // behind a setup stack trace.
    console.warn(
      `[global-setup] fixture purge skipped: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
