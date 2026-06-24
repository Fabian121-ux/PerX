"use server";

import { redirect } from "next/navigation";

import { getPrisma } from "@/lib/db/prisma";
import { hasDatabaseUrl } from "@/lib/env";
import { writeAuditLog } from "@/lib/logging/audit";
import { normalizeRole, type RoleName } from "@/lib/permissions/capabilities";
import { requireUser } from "@/lib/auth/session";
import { isLocalTestUser } from "@/lib/dev/test-auth";

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
  if (isLocalTestUser(user)) redirect("/app");
  if (!hasDatabaseUrl()) redirect("/app/roles?error=database-not-configured");

  const roles = formData
    .getAll("roles")
    .map((role) => normalizeRole(role))
    .filter((role): role is RoleName => Boolean(role) && role !== "ADMIN");
  if (roles.length === 0) redirect("/app/roles?error=choose-role");

  await getPrisma().$transaction(async (tx) => {
    await tx.userRole.deleteMany({ where: { userId: user.id, role: { name: { not: "ADMIN" } } } });
    for (const roleName of roles) {
      const role = await ensureRole(roleName);
      await tx.userRole.create({ data: { roleId: role.id, userId: user.id } });
    }
  });

  await writeAuditLog({ actorId: user.id, action: "roles.update", entityId: user.id, entityType: "user" });
  redirect("/app");
}
