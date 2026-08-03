function assertIsolatedDatabaseUrl(testDbUrl: string, variableName: string) {
  // Production host/fingerprint checks
  const prodMatches = [
    "aws-0-eu-north-1.pooler.supabase.com",
    "qtmvausduxiqcguckfql",
    "13.60.109.208",
  ];

  for (const match of prodMatches) {
    if (testDbUrl.includes(match)) {
      throw new Error(
        `Safety Guard: ${variableName} matches Production fingerprint (${match}). Refusing to execute test against Production database.`,
      );
    }
  }

  let parsed: URL;
  try {
    parsed = new URL(testDbUrl);
  } catch {
    throw new Error(`Safety Guard: ${variableName} is not a valid URL.`);
  }

  if (!new Set(["postgres:", "postgresql:"]).has(parsed.protocol)) {
    throw new Error(`Safety Guard: ${variableName} must use PostgreSQL.`);
  }
  for (const key of parsed.searchParams.keys()) {
    if (key !== "schema") {
      throw new Error(
        `Safety Guard: ${variableName} parameter ${key} is not allowed.`,
      );
    }
  }
  const loopbackHosts = new Set(["127.0.0.1", "localhost", "[::1]"]);
  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  if (!loopbackHosts.has(parsed.hostname)) {
    throw new Error(
      `Safety Guard: ${variableName} must use an exact loopback hostname.`,
    );
  }
  if (!/^perx_(?:test|e2e)(?:_|$)/.test(databaseName)) {
    throw new Error(
      `Safety Guard: ${variableName} must target a perx_test or perx_e2e database.`,
    );
  }
}

export function hasIsolatedTestDatabase() {
  const testDbUrl = process.env.TEST_DATABASE_URL || "";
  if (!testDbUrl) return false;

  assertIsolatedDatabaseUrl(testDbUrl, "TEST_DATABASE_URL");

  return true;
}

export function getIsolatedTestDatabaseUrl() {
  return hasIsolatedTestDatabase() ? process.env.TEST_DATABASE_URL! : null;
}

export function enforceTestDatabaseIsolation() {
  if (!hasIsolatedTestDatabase()) {
    throw new Error("Safety Guard: TEST_DATABASE_URL is not provided.");
  }
  if (process.env.TEST_DIRECT_URL) {
    assertIsolatedDatabaseUrl(process.env.TEST_DIRECT_URL, "TEST_DIRECT_URL");
  }
}
