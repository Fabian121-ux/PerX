"use server";

import { redirect } from "next/navigation";

import { getPrisma } from "@/lib/db/prisma";
import { hasDatabaseUrl, getResolvedDataMode } from "@/lib/env";
import { writeAuditLog } from "@/lib/logging/audit";
import { normalizeRole, type RoleName } from "@/lib/permissions/capabilities";
import { requireUser } from "@/lib/auth/session";

async function ensureRole(role: RoleName) {
  return getPrisma().role.upsert({
    create: {
      description: `${role} capability set.`,
      label: role.toLowerCase().replaceAll("_", " "),
      name: role,
    },
    update: {},
    where: { name: role },
  });
}

/**
 * Roles a user may assign to themselves.
 *
 * CLIENT, FOUNDER and PROPERTY_OWNER were removed: each one carries
 * `opportunity:create`, so this form was a self-service grant of creation
 * access. Anyone could tick a box and bypass review entirely, which made the
 * Create authorization gate decorative.
 *
 * Creation access is now requested through the trader application and granted
 * by a reviewer. What remains here are descriptive roles that carry no
 * publishing capability.
 */
const selfAssignableRoles = new Set<RoleName>(["FREELANCER", "INVESTOR"]);

export async function updateRolesAction(formData: FormData) {
  const user = await requireUser();
  if (getResolvedDataMode() === "mock") redirect("/app?mock=true");
  if (!hasDatabaseUrl()) redirect("/app/roles?error=database-not-configured");

  const roles = formData
    .getAll("roles")
    .map((role) => normalizeRole(role))
    .filter(
      (role): role is RoleName =>
        role !== null && selfAssignableRoles.has(role),
    );
  if (roles.length === 0) redirect("/app/roles?error=choose-role");

  try {
    await getPrisma().$transaction(async (tx) => {
      /*
        Only the self-assignable roles are cleared and rewritten.

        The previous predicate excluded ADMIN alone, so submitting this form
        silently stripped MASTER_ADMIN, INTERNAL_TESTER, MEMBER, and any
        reviewer-granted trading role - a user could revoke their own approved
        access just by updating an unrelated preference.
      */
      await tx.userRole.deleteMany({
        where: {
          role: { name: { in: [...selfAssignableRoles] } },
          userId: user.id,
        },
      });
      for (const roleName of roles) {
        const role = await ensureRole(roleName);
        await tx.userRole.create({
          data: { roleId: role.id, userId: user.id },
        });
      }
    });
  } catch (error) {
    console.error("Failed to update roles:", error);
    redirect("/app/roles?error=server-error");
  }

  await writeAuditLog({
    actorId: user.id,
    action: "roles.update",
    entityId: user.id,
    entityType: "user",
  });
  redirect("/app?success=roles-updated");
}
