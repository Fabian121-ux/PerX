import { spawnSync } from "node:child_process";

import { enforceTestDatabaseIsolation } from "../tests/e2e/utils/db-guard";
import { loadTestEnv } from "../tests/utils/load-test-env";

// Unlike the optional DB cases in `npm test`, this command must never skip.
loadTestEnv();
enforceTestDatabaseIsolation();
const result = spawnSync(
  process.execPath,
  [
    "node_modules/vitest/vitest.mjs",
    "run",
    "tests/integration/authorization.test.ts",
    ...process.argv.slice(2),
  ],
  { env: process.env, stdio: "inherit" },
);
if (result.error) throw result.error;
process.exit(result.status ?? 1);
