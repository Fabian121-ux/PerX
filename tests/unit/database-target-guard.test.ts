import { describe, expect, it } from "vitest";

import {
  assertSafePrismaDatabaseTarget,
  describeDatabaseTarget,
  isLocalDatabaseUrl,
  isPrismaDatabaseCommand,
  parseDatabaseTarget,
  REMOTE_OPT_IN_VALUE,
  REMOTE_OPT_IN_VARIABLE,
} from "@/lib/db/target-guard";

const LOCAL = "postgresql://postgres:secret@127.0.0.1:55434/perx_test?schema=public";
const LOCAL_ALT = "postgresql://postgres:secret@localhost:55434/perx_test";
const REMOTE =
  "postgresql://postgres.qtmvausduxiqcguckfql:secret@aws-0-eu-north-1.pooler.supabase.com:5432/postgres?schema=test_schema_2";

/** `prisma migrate deploy` - the invocation that caused the incident. */
const MIGRATE_DEPLOY = ["node", "prisma", "migrate", "deploy"];

describe("database target guard", () => {
  describe("required environment combinations", () => {
    it("allows DATABASE_URL local + DIRECT_URL local", () => {
      const result = assertSafePrismaDatabaseTarget({
        argv: MIGRATE_DEPLOY,
        env: { DATABASE_URL: LOCAL, DIRECT_URL: LOCAL },
      });

      expect(result.skipped).toBe(false);
      expect(result.checked).toEqual(["DIRECT_URL", "DATABASE_URL"]);
    });

    it("rejects DATABASE_URL local + DIRECT_URL remote", () => {
      // The exact incident configuration: only DATABASE_URL was overridden, so
      // Prisma silently used the remote DIRECT_URL from `.env`.
      expect(() =>
        assertSafePrismaDatabaseTarget({
          argv: MIGRATE_DEPLOY,
          env: { DATABASE_URL: LOCAL, DIRECT_URL: REMOTE },
        }),
      ).toThrow(/DIRECT_URL does not point at a local database/);
    });

    it("rejects DATABASE_URL remote + DIRECT_URL local", () => {
      // Prisma prefers DIRECT_URL, so this target would be local - but a
      // half-remote environment is never intentional, and shadow-database and
      // diff operations can still read DATABASE_URL.
      expect(() =>
        assertSafePrismaDatabaseTarget({
          argv: MIGRATE_DEPLOY,
          env: { DATABASE_URL: REMOTE, DIRECT_URL: LOCAL },
        }),
      ).toThrow(/DATABASE_URL does not point at a local database/);
    });

    it("rejects DATABASE_URL remote + DIRECT_URL remote", () => {
      expect(() =>
        assertSafePrismaDatabaseTarget({
          argv: MIGRATE_DEPLOY,
          env: { DATABASE_URL: REMOTE, DIRECT_URL: REMOTE },
        }),
      ).toThrow(/does not point at a local database/);
    });
  });

  describe("fail-closed behaviour", () => {
    it("rejects when no database URL is set at all", () => {
      expect(() =>
        assertSafePrismaDatabaseTarget({ argv: MIGRATE_DEPLOY, env: {} }),
      ).toThrow(/no database URL is set/);
    });

    it("rejects an unparseable URL rather than assuming it is safe", () => {
      expect(() =>
        assertSafePrismaDatabaseTarget({
          argv: MIGRATE_DEPLOY,
          env: { DATABASE_URL: "not-a-url" },
        }),
      ).toThrow(/does not point at a local database/);
    });

    it("rejects a non-PostgreSQL protocol", () => {
      expect(isLocalDatabaseUrl("mysql://root@127.0.0.1:3306/perx")).toBe(false);
    });

    it("rejects hostnames that merely resemble loopback", () => {
      expect(isLocalDatabaseUrl("postgresql://u:p@localhost.evil.com/db")).toBe(
        false,
      );
      expect(isLocalDatabaseUrl("postgresql://u:p@127.0.0.1.evil.com/db")).toBe(
        false,
      );
      expect(isLocalDatabaseUrl("postgresql://u:p@notlocalhost/db")).toBe(false);
    });

    it("does not treat a remote schema named like a test as local", () => {
      // `test_schema_2` on remote infrastructure is still remote.
      expect(isLocalDatabaseUrl(REMOTE)).toBe(false);
    });

    it("accepts loopback spellings", () => {
      expect(isLocalDatabaseUrl(LOCAL)).toBe(true);
      expect(isLocalDatabaseUrl(LOCAL_ALT)).toBe(true);
      expect(isLocalDatabaseUrl("postgresql://u:p@[::1]:5432/perx_test")).toBe(
        true,
      );
    });
  });

  describe("command classification", () => {
    it.each([
      ["migrate", "deploy"],
      ["migrate", "dev"],
      ["migrate", "reset"],
      ["migrate", "status"],
      ["db", "push"],
      ["db", "execute"],
      ["db", "seed"],
    ])("treats prisma %s %s as a database command", (group, sub) => {
      expect(isPrismaDatabaseCommand(["node", "prisma", group, sub])).toBe(true);
    });

    it("treats schema-only commands as safe", () => {
      // `postinstall` runs `prisma generate`; requiring a database there would
      // break `npm install`.
      expect(isPrismaDatabaseCommand(["node", "prisma", "generate"])).toBe(false);
      expect(isPrismaDatabaseCommand(["node", "prisma", "validate"])).toBe(false);
      expect(isPrismaDatabaseCommand(["node", "prisma", "format"])).toBe(false);
    });

    it("treats an ambiguous group with no subcommand as connecting", () => {
      expect(isPrismaDatabaseCommand(["node", "prisma", "migrate"])).toBe(true);
    });

    it("ignores flags when locating the subcommand", () => {
      expect(
        isPrismaDatabaseCommand([
          "node",
          "prisma",
          "--schema=prisma/schema.prisma",
          "migrate",
          "deploy",
        ]),
      ).toBe(true);
    });

    it("skips the guard entirely for schema-only commands", () => {
      const result = assertSafePrismaDatabaseTarget({
        argv: ["node", "prisma", "generate"],
        env: { DATABASE_URL: REMOTE, DIRECT_URL: REMOTE },
      });

      expect(result.skipped).toBe(true);
    });
  });

  describe("explicit remote opt-in", () => {
    it("allows a remote target only with the exact opt-in value", () => {
      const result = assertSafePrismaDatabaseTarget({
        argv: MIGRATE_DEPLOY,
        env: {
          DATABASE_URL: REMOTE,
          DIRECT_URL: REMOTE,
          [REMOTE_OPT_IN_VARIABLE]: REMOTE_OPT_IN_VALUE,
        },
      });

      expect(result.skipped).toBe(true);
    });

    it("rejects a truthy but incorrect opt-in value", () => {
      for (const value of ["1", "true", "yes", ""]) {
        expect(() =>
          assertSafePrismaDatabaseTarget({
            argv: MIGRATE_DEPLOY,
            env: {
              DATABASE_URL: REMOTE,
              DIRECT_URL: REMOTE,
              [REMOTE_OPT_IN_VARIABLE]: value,
            },
          }),
        ).toThrow(/does not point at a local database/);
      }
    });
  });

  describe("sanitized reporting", () => {
    it("never includes credentials in the description", () => {
      const description = describeDatabaseTarget(LOCAL);

      expect(description).not.toContain("secret");
      expect(description).not.toContain("postgres:secret");
      expect(description).toBe(
        "host=127.0.0.1 port=55434 database=perx_test schema=public",
      );
    });

    it("never includes credentials in a rejection message", () => {
      try {
        assertSafePrismaDatabaseTarget({
          argv: MIGRATE_DEPLOY,
          env: { DIRECT_URL: REMOTE },
        });
        throw new Error("expected the guard to reject");
      } catch (error) {
        const message = (error as Error).message;
        expect(message).not.toContain("secret");
        expect(message).toContain("host=aws-0-eu-north-1.pooler.supabase.com");
      }
    });

    it("parses target parts without exposing the password", () => {
      const target = parseDatabaseTarget(LOCAL);

      expect(target).toEqual({
        database: "perx_test",
        host: "127.0.0.1",
        port: "55434",
        schema: "public",
      });
      expect(JSON.stringify(target)).not.toContain("secret");
    });
  });
});
