"use server";

import { redirect } from "next/navigation";

import { getPrisma } from "@/lib/db/prisma";
import { hasDatabaseUrl, getResolvedDataMode } from "@/lib/env";
import { writeAuditLog } from "@/lib/logging/audit";
import {
  normalizeRole,
  selfAssignableRoles,
  type RoleName,
} from "@/lib/permissions/capabilities";
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


export async function updateRolesAction(formData: FormData) {
  const user = await requireUser();
  if (getResolvedDataMode() === "mock") redirect("/app?mock=true");
  if (!hasDatabaseUrl()) redirect("/app/roles?error=database-not-configured");

  const submitted = formData.getAll("roles");
  const roles = submitted
    .map((role) => normalizeRole(role))
    .filter(
      (role): role is RoleName =>
        role !== null && selfAssignableRoles.has(role),
    );
  /*
   * Two different failures, previously collapsed into one misleading message.
   *
   * Submitting nothing is genuinely "choose a role". Submitting only roles this
   * form cannot grant is not: the user DID choose, and telling them otherwise
   * sends them back to repeat the same action. The UI no longer offers those
   * options, so this is reachable only by a hand-crafted POST - but it must
   * still not assert a cause that is untrue.
   */
  if (roles.length === 0) {
    redirect(
      submitted.length === 0
        ? "/app/roles?error=choose-role"
        : "/app/roles?error=role-not-self-assignable",
    );
  }

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
