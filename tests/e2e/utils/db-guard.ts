export function enforceTestDatabaseIsolation() {
  const testDbUrl = process.env.TEST_DATABASE_URL || "";
  const prodDbUrl = process.env.DATABASE_URL || "";
  
  if (!testDbUrl) {
    throw new Error("Safety Guard: TEST_DATABASE_URL is not provided.");
  }
  
  // Production host/fingerprint checks
  const prodMatches = [
    "aws-0-eu-north-1.pooler.supabase.com",
    "qtmvausduxiqcguckfql",
    "13.60.109.208"
  ];
  
  for (const match of prodMatches) {
    if (testDbUrl.includes(match)) {
      throw new Error(`Safety Guard: TEST_DATABASE_URL matches Production fingerprint (${match}). Refusing to execute test against Production database.`);
    }
  }

  if (testDbUrl === prodDbUrl && prodDbUrl !== "") {
    throw new Error("Safety Guard: TEST_DATABASE_URL matches DATABASE_URL exactly.");
  }
}
