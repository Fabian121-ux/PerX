"use server";

import { redirect } from "next/navigation";

import { getPrisma } from "@/lib/db/prisma";
import { writeAuditLog } from "@/lib/logging/audit";
import { createSession, destroySession } from "@/lib/auth/session";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { hasDatabaseUrl, getResolvedDataMode } from "@/lib/env";
import { signInSchema, signUpSchema } from "@/lib/validation/auth";

function usernameFromEmail(email: string) {
  return (
    email
      .split("@")[0]
      ?.toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "member"
  );
}

export async function signUpAction(formData: FormData) {
  if (getResolvedDataMode() === "mock")
    redirect("/app/profile/setup?mock=true");
  if (!hasDatabaseUrl()) redirect("/sign-up?error=database-not-configured");

  const parsed = signUpSchema.safeParse({
    email: formData.get("email"),
    name: formData.get("name"),
    password: formData.get("password"),
  });

  if (!parsed.success) redirect("/sign-up?error=check-fields");

  const passwordHash = await hashPassword(parsed.data.password);
  const baseUsername = usernameFromEmail(parsed.data.email);
  const existing = await getPrisma().user.count({
    where: { username: baseUsername },
  });
  const username = existing ? `${baseUsername}-${existing + 1}` : baseUsername;

  let user;
  try {
    user = await getPrisma().user.create({
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
  } catch (error: unknown) {
    const err = error as Error & {
      code?: string;
      meta?: { target?: string | string[] };
    };
    if (err.code === "P2002") {
      const target = err.meta?.target;
      if (Array.isArray(target)) {
        if (target.includes("email")) redirect("/sign-up?error=email-taken");
        if (target.includes("username"))
          redirect("/sign-up?error=username-taken");
      } else if (typeof target === "string") {
        if (target.includes("email")) redirect("/sign-up?error=email-taken");
        if (target.includes("username"))
          redirect("/sign-up?error=username-taken");
      }
    }
    console.error("Sign-up error:", error);
    redirect("/sign-up?error=server-error");
  }

  await createSession(user.id);
  await writeAuditLog({
    actorId: user.id,
    action: "auth.sign_up",
    entityId: user.id,
    entityType: "user",
  });
  redirect("/app/profile/setup");
}

export async function signInAction(formData: FormData) {
  if (getResolvedDataMode() === "mock") redirect("/app?mock=true");
  if (!hasDatabaseUrl()) redirect("/sign-in?error=database-not-configured");

  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) redirect("/sign-in?error=invalid-credentials");

  let user;
  try {
    user = await getPrisma().user.findUnique({
      where: { email: parsed.data.email },
    });
  } catch (error: unknown) {
    console.error("Sign-in DB error:", error);
    redirect("/sign-in?error=unavailable");
  }

  if (
    !user ||
    !(await verifyPassword(parsed.data.password, user.passwordHash))
  ) {
    redirect("/sign-in?error=invalid-credentials");
  }

  if (!user.isActive) {
    redirect("/sign-in?error=account-deactivated");
  }

  await createSession(user.id);
  await writeAuditLog({
    actorId: user.id,
    action: "auth.sign_in",
    entityId: user.id,
    entityType: "user",
  });
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
