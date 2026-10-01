/** Operator-only, additive account setup. Dry run unless --apply is supplied.
 * Never copies passwordHash, deletes users, or matches an app account at login by email.
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import {
  authEmailRedirect,
  supabaseAuthConfig,
} from "../src/lib/auth/supabase-config";
const args = process.argv.slice(2);
const appId = args.find((v) => v.startsWith("--app-user-id="))?.slice(14);
const authId = args.find((v) => v.startsWith("--auth-user-id="))?.slice(15);
const create = args.includes("--create-identity");
const apply = args.includes("--apply");
async function main() {
  if (!appId || (!authId && !create) || (authId && create))
    throw new Error(
      "Specify --app-user-id and exactly one of --auth-user-id or --create-identity.",
    );
  if (!process.env.DATABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY)
    throw new Error(
      "Database and server-only provider admin configuration are required.",
    );
  const { url, key } = supabaseAuthConfig();
  const redirectTo = authEmailRedirect();
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
  try {
    const app = await db.user.findUniqueOrThrow({ where: { id: appId } });
    if (app.authUserId)
      throw new Error("Application account is already linked. No change made.");
    if (!app.isActive || app.bannedAt || app.deactivatedAt)
      throw new Error("Account is not eligible for setup.");
    console.info({
      operation: "supabase-account-link",
      mode: apply ? "apply" : "dry-run",
      classification: app.accountClassification,
      existingDataPreserved: true,
    });
    if (!apply) return;
    const result = create
      ? await admin.auth.admin.createUser({
          email: app.email,
          email_confirm: false,
        })
      : await admin.auth.admin.getUserById(authId!);
    if (result.error || !result.data.user)
      throw new Error(
        "Provider identity setup failed; no application link written.",
      );
    const identity = result.data.user;
    if (identity.email?.toLowerCase() !== app.email.toLowerCase())
      throw new Error(
        "Provider identity email does not match the operator-selected application record.",
      );
    // Compare-and-set prevents concurrent relinking. The UUID unique index prevents sharing an identity.
    await db.$transaction(async (tx) => {
      const changed = await tx.user.updateMany({
        where: { id: app.id, authUserId: null },
        data: { authUserId: identity.id },
      });
      if (changed.count !== 1)
        throw new Error("Application link changed concurrently.");
      await tx.session.deleteMany({ where: { userId: app.id } });
      await tx.auditLog.create({
        data: {
          entityType: "user",
          entityId: app.id,
          action: "auth.supabase.operator_linked",
        },
      });
    });
    const client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const reset = await client.auth.resetPasswordForEmail(app.email, {
      redirectTo,
    });
    if (reset.error)
      throw new Error(
        "Link saved; password setup email failed. Retry through password recovery after fixing delivery.",
      );
    console.info({
      operation: "supabase-account-link",
      status: "linked",
      passwordSetup: "requested",
      existingDataPreserved: true,
    });
  } finally {
    await db.$disconnect();
  }
}
main().catch(() => {
  console.error(
    "Account setup did not complete. Inspect the link with read-only tooling before retrying; no users were deleted. Provider and database details are intentionally omitted.",
  );
  process.exitCode = 1;
});
