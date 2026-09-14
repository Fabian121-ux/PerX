import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  writeFileSync,
  readFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  renderManifestModule,
  readMigrationNames,
} from "../../scripts/generate-migration-manifest.mjs";

/**
 * The manifest is the repo's half of the drift comparison. If it can silently
 * disagree with `prisma/migrations/`, the whole check is worthless - so the
 * generator is tested directly, and CI re-runs it and diffs the result.
 */

const created: string[] = [];

function migrationsFixture(names: string[], extras: string[] = []) {
  const dir = mkdtempSync(path.join(tmpdir(), "perx-migrations-"));
  created.push(dir);
  for (const name of names) mkdirSync(path.join(dir, name));
  for (const file of extras) writeFileSync(path.join(dir, file), "x");
  return dir;
}

describe("migration manifest generator", () => {
  afterEach(() => {
    while (created.length) {
      rmSync(created.pop() as string, { force: true, recursive: true });
    }
  });

  it("sorts lexicographically regardless of directory order", () => {
    const dir = migrationsFixture([
      "20260827150000_trader_applications",
      "0001_init",
      "20260722122447_network_and_support_beta",
      "0002_open_beta_registration",
    ]);

    expect(readMigrationNames(dir)).toEqual([
      "0001_init",
      "0002_open_beta_registration",
      "20260722122447_network_and_support_beta",
      "20260827150000_trader_applications",
    ]);
  });

  it("excludes migration_lock.toml and any other loose file", () => {
    const dir = migrationsFixture(
      ["0001_init"],
      ["migration_lock.toml", "README.md", ".DS_Store"],
    );

    expect(readMigrationNames(dir)).toEqual(["0001_init"]);
  });

  it("produces byte-identical output across repeated runs", () => {
    const dir = migrationsFixture(["0002_b", "0001_a"]);

    expect(renderManifestModule(readMigrationNames(dir))).toBe(
      renderManifestModule(readMigrationNames(dir)),
    );
  });

  it("emits a readonly string[] typed module", () => {
    const rendered = renderManifestModule(["0001_init", "0002_next"]);

    expect(rendered).toContain("readonly string[]");
    expect(rendered).toContain('"0001_init"');
    expect(rendered).toContain('"0002_next"');
    expect(rendered).toContain("MIGRATION_MANIFEST");
  });

  it("handles an empty migrations directory without producing invalid TypeScript", () => {
    const dir = migrationsFixture([]);
    const rendered = renderManifestModule(readMigrationNames(dir));

    expect(rendered).toContain("MIGRATION_MANIFEST");
    expect(rendered).not.toContain("undefined");
  });

  it("keeps the committed manifest in step with prisma/migrations", () => {
    // This is the same comparison CI performs. It fails locally the moment a
    // migration is added without regenerating, which is the September failure
    // mode reduced to a unit test.
    const repoRoot = path.resolve(__dirname, "../..");
    const expected = renderManifestModule(
      readMigrationNames(path.join(repoRoot, "prisma/migrations")),
    );
    const committed = readFileSync(
      path.join(repoRoot, "src/generated/migration-manifest.ts"),
      "utf8",
    );

    expect(committed).toBe(expected);
  });
});
