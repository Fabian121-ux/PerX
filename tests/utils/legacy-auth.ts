/** Existing rollback-path coverage. Supabase's default path has separate unit,
 * real-Postgres integration and real-provider browser acceptance suites. */
import { beforeEach, afterEach } from "vitest";
let original: string | undefined;
beforeEach(() => {
  original = process.env.PERX_AUTH_PROVIDER;
  process.env.PERX_AUTH_PROVIDER = "legacy";
});
afterEach(() => {
  if (original === undefined) delete process.env.PERX_AUTH_PROVIDER;
  else process.env.PERX_AUTH_PROVIDER = original;
});
