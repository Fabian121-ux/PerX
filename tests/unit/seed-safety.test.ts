import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const seedSource = readFileSync(join(process.cwd(), "prisma", "seed.ts"), "utf8");

describe("seed safety guardrails", () => {
  it("does not contain the old hardcoded local database fallback", () => {
    expect(seedSource).not.toContain("perx_password@localhost");
    expect(seedSource).toContain("DIRECT_URL or DATABASE_URL is required");
  });

  it("requires explicit flags for development users and sample marketplace data", () => {
    expect(seedSource).toContain('PERX_ALLOW_DEV_SEED === "true"');
    expect(seedSource).toContain('PERX_ALLOW_SAMPLE_DATA === "true"');
    expect(seedSource).toContain("PERX_SEED_DATABASE_LABEL");
    expect(seedSource).toContain("Refusing to seed");
  });

  it("does not update existing user password hashes during seed", () => {
    expect(seedSource).toContain("password hash was not changed");
    expect(seedSource).not.toContain("update: { passwordHash");
  });

  it("keeps baseline role and category seed idempotent without overwriting existing labels", () => {
    expect(seedSource).toContain("seedBaseline");
    expect(seedSource).toContain("update: {}");
  });

  it("keeps normal and admin test accounts separate", () => {
    expect(seedSource).toContain("DEV_TEST_USER_EMAIL");
    expect(seedSource).toContain("DEV_ADMIN_EMAIL");
    expect(seedSource).toContain('roles: ["ADMIN"]');
    expect(seedSource).toContain('roles: ["FREELANCER", "CLIENT", "FOUNDER"]');
  });
});
