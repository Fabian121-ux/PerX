"use server";

import { redirect } from "next/navigation";

import { getPrisma } from "@/lib/db/prisma";
import { writeAuditLog } from "@/lib/logging/audit";
import { createSession, destroySession } from "@/lib/auth/session";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { normalizeRole, type RoleName } from "@/lib/permissions/capabilities";
import { hasDatabaseUrl } from "@/lib/env";
import { signInSchema, signUpSchema } from "@/lib/validation/auth";

function usernameFromEmail(email: string) {
  return email.split("@")[0]?.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "member";
}

async function ensureRole(role: RoleName) {
  return getPrisma().role.upsert({
    where: { name: role },
    update: {},
    create: {
      name: role,
      label: role
        .toLowerCase()
        .split("_")
        .map((part) => part[0].toUpperCase() + part.slice(1))
        .join(" "),
      description: `${role} capability set`,
    },
  });
}

export async function signUpAction(formData: FormData) {
  if (!hasDatabaseUrl()) redirect("/sign-up?error=database-not-configured");

  const roles = formData
    .getAll("roles")
    .map((role) => normalizeRole(role))
    .filter(Boolean) as RoleName[];

  const parsed = signUpSchema.safeParse({
    email: formData.get("email"),
    name: formData.get("name"),
    password: formData.get("password"),
    roles,
  });

  if (!parsed.success) redirect("/sign-up?error=check-fields");

  const passwordHash = await hashPassword(parsed.data.password);
  const baseUsername = usernameFromEmail(parsed.data.email);
  const existing = await getPrisma().user.count({ where: { username: baseUsername } });
  const username = existing ? `${baseUsername}-${existing + 1}` : baseUsername;

  const user = await getPrisma().user.create({
    data: {
      email: parsed.data.email,
      name: parsed.data.name,
      passwordHash,
      username,
      profile: {
        create: {
          biography: "Profile setup is in progress.",
          headline: "New perX member",
          location: "Remote",
          profileCompleteness: 30,
        },
      },
    },
  });

  for (const roleName of parsed.data.roles) {
    const role = await ensureRole(roleName);
    await getPrisma().userRole.create({ data: { roleId: role.id, userId: user.id } });
  }

  await createSession(user.id);
  await writeAuditLog({ actorId: user.id, action: "auth.sign_up", entityId: user.id, entityType: "user" });
  redirect("/app/profile/setup");
}

export async function signInAction(formData: FormData) {
  if (!hasDatabaseUrl()) redirect("/sign-in?error=database-not-configured");

  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) redirect("/sign-in?error=invalid-credentials");

  const user = await getPrisma().user.findUnique({ where: { email: parsed.data.email } });
  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    redirect("/sign-in?error=invalid-credentials");
  }

  await createSession(user.id);
  await writeAuditLog({ actorId: user.id, action: "auth.sign_in", entityId: user.id, entityType: "user" });
  redirect("/app");
}

export async function signOutAction() {
  await destroySession();
  redirect("/");
}

export async function passwordRecoveryAction(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  await writeAuditLog({
    action: "auth.password_recovery_requested",
    entityType: "user",
    metadata: { emailSubmitted: Boolean(email) },
  });
  redirect("/password-recovery?status=requested");
}


