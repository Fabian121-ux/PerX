/**
 * Database target guard.
 *
 * Shared, dependency-free primitives for deciding whether a database URL is a
 * safe target for a local/test database-management command.
 *
 * Why this exists
 * ---------------
 * `prisma.config.ts` resolves the Prisma CLI datasource as
 * `DIRECT_URL ?? DATABASE_URL`, and it calls `import "dotenv/config"`, which
 * loads `.env` - the file that holds remote credentials. A developer who
 * overrides only `DATABASE_URL` (the obvious variable) therefore still runs
 * against whatever `DIRECT_URL` happens to be, with no warning. That is how a
 * `migrate deploy` intended for a local container reached a remote host.
 *
 * The rule enforced here is fail-closed: for any Prisma command that connects
 * to a database, every database URL in play must resolve to loopback, unless
 * remote access is explicitly and deliberately opted into.
 *
 * Deliberately NOT used for application runtime. Production legitimately runs
 * against a remote database; this module only constrains CLI/management
 * commands. Nothing here is imported by `src/lib/db/prisma.ts`.
 *
 * No imports: `prisma.config.ts` is loaded by the Prisma CLI outside the Next
 * module graph, so path aliases and app-only helpers are unavailable.
 */

/**
 * Hostnames treated as local. Exact matches only.
 *
 * `URL` normalises IPv6 hosts with brackets, so both spellings are listed.
 * Names that merely look local (`db.local`, `localhost.example.com`) are
 * intentionally excluded - only an exact match is trusted.
 */
export const LOOPBACK_HOSTS: ReadonlySet<string> = new Set([
  "127.0.0.1",
  "::1",
  "[::1]",
  "localhost",
]);

/**
 * Known remote fingerprints, checked as substrings of the raw URL.
 *
 * A defence-in-depth layer on top of the loopback check: it catches a
 * credential or project ref appearing somewhere the URL parser would not
 * classify as the hostname. Mirrors `tests/e2e/utils/db-guard.ts`.
 */
export const REMOTE_FINGERPRINTS: readonly string[] = [
  "aws-0-eu-north-1.pooler.supabase.com",
  "qtmvausduxiqcguckfql",
  "13.60.109.208",
  ".pooler.supabase.com",
  ".supabase.co",
];

/**
 * Environment variable that authorises a remote database-management command.
 *
 * Verbose on purpose. A deploy pipeline can set it deliberately; nobody types
 * it by accident, and it does not resemble an ordinary flag.
 */
export const REMOTE_OPT_IN_VARIABLE = "PERX_ALLOW_REMOTE_DATABASE_COMMAND";
export const REMOTE_OPT_IN_VALUE = "i-understand-this-targets-remote-data";

export type DatabaseTarget = {
  database: string;
  host: string;
  port: string;
  schema: string | null;
};

/**
 * Parse a database URL into its sanitized, non-secret parts.
 *
 * Credentials are never read out of the parsed URL, so a `DatabaseTarget` is
 * always safe to log.
 */
export function parseDatabaseTarget(url: string): DatabaseTarget | null {
  if (!url) return null;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
    return null;
  }

  return {
    database: decodeURIComponent(parsed.pathname.replace(/^\//, "")) || "(none)",
    host: parsed.hostname,
    port: parsed.port || "5432",
    schema: parsed.searchParams.get("schema"),
  };
}

/** Human-readable target with no credentials. Safe for logs and errors. */
export function describeDatabaseTarget(url: string): string {
  const target = parseDatabaseTarget(url);
  if (!target) return "(unparseable database URL)";

  return `host=${target.host} port=${target.port} database=${target.database} schema=${target.schema ?? "(default)"}`;
}

export function isLoopbackHost(host: string): boolean {
  return LOOPBACK_HOSTS.has(host);
}

export function matchesRemoteFingerprint(url: string): string | null {
  return REMOTE_FINGERPRINTS.find((f) => url.includes(f)) ?? null;
}

/**
 * Whether a URL is a safe local target.
 *
 * Fail-closed: anything unparseable, non-PostgreSQL, fingerprinted or
 * non-loopback is unsafe. An unknown shape is never given the benefit of the
 * doubt.
 */
export function isLocalDatabaseUrl(url: string): boolean {
  if (!url) return false;
  if (matchesRemoteFingerprint(url)) return false;

  const target = parseDatabaseTarget(url);
  return target ? isLoopbackHost(target.host) : false;
}

/**
 * Prisma subcommands that open a database connection.
 *
 * `generate`, `validate` and `format` are absent because they only read the
 * schema file. That matters: `postinstall` runs `prisma generate`, and making
 * it depend on a reachable local database would break `npm install`.
 */
const DATABASE_SUBCOMMANDS: readonly string[] = [
  "deploy",
  "dev",
  "diff",
  "execute",
  "pull",
  "push",
  "reset",
  "resolve",
  "seed",
  "status",
  "studio",
];

const DATABASE_COMMAND_GROUPS: readonly string[] = ["migrate", "db", "studio"];

/**
 * Does this CLI invocation connect to a database?
 *
 * Conservative in the safe direction: `prisma migrate` with no subcommand, or
 * an unrecognised subcommand, still counts as a database command.
 */
export function isPrismaDatabaseCommand(argv: readonly string[]): boolean {
  const args = argv
    .slice(2)
    .filter((arg) => !arg.startsWith("-"))
    .map((arg) => arg.toLowerCase());
  if (!args.length) return false;

  const groupIndex = args.findIndex((arg) =>
    DATABASE_COMMAND_GROUPS.includes(arg),
  );
  if (groupIndex === -1) return false;

  const group = args[groupIndex];
  if (group === "studio") return true;

  const subcommand = args[groupIndex + 1];
  // `prisma migrate` alone is ambiguous, so treat it as connecting.
  if (!subcommand) return true;
  // `prisma migrate diff` can be purely file-based, but it also accepts
  // datasource inputs, so it stays on the guarded list.
  return DATABASE_SUBCOMMANDS.includes(subcommand);
}

/**
 * Minimal environment shape.
 *
 * Only the variables the guard reads, rather than `NodeJS.ProcessEnv`, so
 * callers (and tests) can pass a small literal without having to satisfy
 * unrelated required keys such as `NODE_ENV`.
 */
export type GuardEnv = Readonly<Record<string, string | undefined>>;

export function isRemoteCommandAuthorized(env: GuardEnv = process.env): boolean {
  return env[REMOTE_OPT_IN_VARIABLE] === REMOTE_OPT_IN_VALUE;
}

export type GuardInput = {
  argv?: readonly string[];
  env?: GuardEnv;
};

/**
 * Fail-closed check for a Prisma database-management command.
 *
 * Every database URL that is set is validated, not just the one Prisma
 * ultimately selects. `DIRECT_URL` remote with `DATABASE_URL` local is exactly
 * the configuration that caused the incident, and the reverse is rejected too:
 * shadow-database and diff operations can read `DATABASE_URL`, and a
 * half-local, half-remote environment is never intentional.
 *
 * Throws with a sanitized, actionable message. Returns the variables checked.
 */
export function assertSafePrismaDatabaseTarget({
  argv = process.argv,
  env = process.env,
}: GuardInput = {}): { checked: string[]; skipped: boolean } {
  if (!isPrismaDatabaseCommand(argv)) {
    return { checked: [], skipped: true };
  }

  if (isRemoteCommandAuthorized(env)) {
    return { checked: [], skipped: true };
  }

  const candidates: Array<[string, string | undefined]> = [
    ["DIRECT_URL", env.DIRECT_URL],
    ["DATABASE_URL", env.DATABASE_URL],
  ];
  const present = candidates.filter(
    (entry): entry is [string, string] => Boolean(entry[1]),
  );

  if (!present.length) {
    throw new Error(
      [
        "Safety Guard: no database URL is set for a Prisma database command.",
        "Set DATABASE_URL and DIRECT_URL to a loopback database, or run:",
        "  npm run db:local -- <prisma args>",
      ].join("\n"),
    );
  }

  for (const [name, url] of present) {
    if (isLocalDatabaseUrl(url)) continue;

    const fingerprint = matchesRemoteFingerprint(url);
    throw new Error(
      [
        `Safety Guard: ${name} does not point at a local database.`,
        `  ${describeDatabaseTarget(url)}`,
        fingerprint ? `  matched remote fingerprint: ${fingerprint}` : null,
        "",
        "Prisma database commands are restricted to loopback hosts",
        `(${[...LOOPBACK_HOSTS].join(", ")}).`,
        "",
        "Note: Prisma reads DIRECT_URL in preference to DATABASE_URL, and",
        "prisma.config.ts loads .env - so overriding only DATABASE_URL is not",
        "sufficient. Set both, or use: npm run db:local -- <prisma args>",
        "",
        "If you genuinely intend to run against remote infrastructure, set",
        `${REMOTE_OPT_IN_VARIABLE}=${REMOTE_OPT_IN_VALUE}`,
      ]
        .filter((line) => line !== null)
        .join("\n"),
    );
  }

  return { checked: present.map(([name]) => name), skipped: false };
}
