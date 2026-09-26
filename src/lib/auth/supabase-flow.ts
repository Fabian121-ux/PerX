import "server-only";
import { cookies } from "next/headers";
import { redirect, unstable_rethrow } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { Prisma } from "@/generated/prisma/client";
import type {
  AuthFormState,
  PasswordResetFormState,
} from "@/features/auth/actions";
import { getPrisma } from "@/lib/db/prisma";
import { evaluateAccountAccess } from "@/lib/account/enforcement";
import { checkRegistrationGate } from "@/lib/registration/status";
import { logServerDataError } from "@/lib/logging/runtime";
import { signUpSchema, signInSchema, emailSchema } from "@/lib/validation/auth";
import { createSession, destroySession } from "./session";
import {
  createSupabaseServerClient,
  getVerifiedSupabaseIdentity,
  RECOVERY_COOKIE,
  clearSupabaseSession,
} from "./supabase-server";
import { authEmailRedirect, supabaseAuthConfig } from "./supabase-config";
import { consumePasswordResetToken } from "./password-reset";

function report(error: unknown, operation: string) {
  logServerDataError({
    error,
    operation: `auth.supabase.${operation}`,
    route: "/auth",
  });
}
function failure(
  message: string,
  values?: Record<string, string>,
): AuthFormState {
  return { status: "error", message, values };
}
class SignupGateError extends Error {}
async function checkSignup(
  input: z.infer<typeof signUpSchema>,
  tx: Prisma.TransactionClient,
) {
  const gate = await checkRegistrationGate(
    tx as unknown as Parameters<typeof checkRegistrationGate>[0],
  );
  if (!gate.allowed) throw new SignupGateError(gate.message);
  if (
    await tx.user.findFirst({
      where: { OR: [{ email: input.email }, { username: input.username }] },
      select: { id: true },
    })
  )
    throw new SignupGateError(
      "This email or username is already in use. Sign in or recover your existing account.",
    );
}
export async function supabaseSignUp(
  input: z.infer<typeof signUpSchema>,
  values: Record<string, string>,
): Promise<AuthFormState> {
  let identityCreated = false;
  try {
    const redirectTo = authEmailRedirect();
    await getPrisma().$transaction((tx) => checkSignup(input, tx));
    const client = await createSupabaseServerClient(true);
    const { data, error } = await client.auth.signUp({
      email: input.email,
      password: input.password,
      options: { emailRedirectTo: redirectTo },
    });
    if (
      error ||
      !data.user ||
      !z.string().uuid().safeParse(data.user.id).success ||
      !data.user.identities?.length ||
      data.user.email?.toLowerCase() !== input.email
    )
      return failure(
        "Account creation could not be completed. If you already registered, sign in or recover your account.",
        values,
      );
    identityCreated = true;
    // Configuration mistakes must never turn signup into a verified app session.
    if (data.session || data.user.email_confirmed_at) {
      await clearSupabaseSession();
      return failure(
        "Email confirmation is required. Account setup is unavailable; please contact support.",
        values,
      );
    }
    await getPrisma().$transaction(async (tx) => {
      await checkSignup(input, tx);
      const role = await tx.role.upsert({
        where: { name: "MEMBER" },
        update: {},
        create: {
          name: "MEMBER",
          label: "Member",
          description: "Basic PtahX account membership.",
        },
      });
      const user = await tx.user.create({
        data: {
          authUserId: data.user!.id,
          email: input.email,
          name: input.name,
          username: input.username,
          passwordHash: "!supabase-auth-only",
          accountClassification: "PUBLIC_BETA_USER",
          profile: {
            create: {
              biography: "Profile setup is in progress.",
              headline: "New PtahX member",
              location: "Remote",
              profileCompleteness: 30,
            },
          },
          roles: { create: { roleId: role.id } },
        },
        select: { id: true },
      });
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          entityId: user.id,
          entityType: "user",
          action: "auth.supabase.sign_up",
        },
      });
    });
  } catch (error) {
    unstable_rethrow(error);
    report(error, "signup");
    return failure(
      identityCreated
        ? "Your identity was created, but PtahX account setup did not finish. Contact support to complete the link; no application access has been granted."
        : error instanceof SignupGateError
          ? error.message
          : "Account creation is temporarily unavailable. Please try again shortly.",
      values,
    );
  }
  redirect("/sign-in?confirmation=required");
}
export async function supabaseSignIn(
  input: z.infer<typeof signInSchema>,
  nextPath: string,
  values: Record<string, string>,
): Promise<AuthFormState> {
  try {
    const client = await createSupabaseServerClient(true);
    const { data, error } = await client.auth.signInWithPassword(input);
    if (error || !data.user?.email_confirmed_at || !data.session)
      return failure(
        "Sign-in failed. Check your credentials and confirm your email before signing in.",
        values,
      );
    const user = await getPrisma().user.findUnique({
      where: { authUserId: data.user.id },
    });
    // Email and user-editable provider metadata can never select an application account.
    if (
      !user ||
      !evaluateAccountAccess(user).canAuthenticate ||
      !evaluateAccountAccess(user).canAccessApplication
    ) {
      await clearSupabaseSession();
      return failure(
        "Access to this account is unavailable. Contact support if account setup is incomplete.",
        values,
      );
    }
    await createSession(user.id);
  } catch (error) {
    unstable_rethrow(error);
    report(error, "sign_in");
    return failure(
      "The authentication service is temporarily unavailable. Please try again.",
      values,
    );
  }
  redirect(nextPath);
}
export async function requestSupabaseRecovery(email: string) {
  const redirectTo = authEmailRedirect();
  const { url, key } = supabaseAuthConfig();
  const client = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  const { error } = await client.auth.resetPasswordForEmail(email, {
    redirectTo,
  });
  if (error) throw new Error("Provider recovery request failed");
}
export async function supabasePasswordRecovery(form: FormData): Promise<never> {
  const parsed = emailSchema.safeParse(form.get("email") ?? "");
  // Every account lookup and provider request is outside the observable response path.
  after(async () => {
    if (!parsed.success) return;
    try {
      const user = await getPrisma().user.findUnique({
        where: { email: parsed.data },
        select: { authUserId: true, isActive: true },
      });
      if (!user?.isActive || !user.authUserId) return;
      await requestSupabaseRecovery(parsed.data);
    } catch (error) {
      report(error, "recovery");
    }
  });
  redirect("/password-recovery?status=requested");
}
export async function supabaseResetPassword(
  password: string,
): Promise<PasswordResetFormState> {
  try {
    const identity = await getVerifiedSupabaseIdentity();
    const store = await cookies();
    const token = store.get(RECOVERY_COOKIE)?.value;
    if (!identity || !token)
      return {
        status: "error",
        message: "This reset link is invalid or has expired.",
      };
    const user = await getPrisma().user.findUnique({
      where: { authUserId: identity.id },
      select: { id: true },
    });
    if (!user)
      return {
        status: "error",
        message: "Account setup is incomplete. Contact support.",
      };
    const consumed = await consumePasswordResetToken(token);
    if (!consumed.ok || consumed.userId !== user.id)
      return {
        status: "error",
        message: "This reset link is invalid or has expired.",
      };
    // Revoke PtahX access before contacting the password provider. Failure remains closed.
    await getPrisma().$transaction(async (tx) => {
      await tx.session.deleteMany({ where: { userId: user.id } });
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          entityId: user.id,
          entityType: "user",
          action: "auth.supabase.password_reset_started",
        },
      });
    });
    const client = await createSupabaseServerClient(true);
    const { error } = await client.auth.updateUser({ password });
    if (error) throw new Error("Provider password update failed");
    // Close the concurrent old-password sign-in window during the provider round trip.
    // Provider and application writes cannot form one transaction. Revocation must
    // remain effective even if the subsequent completion audit is unavailable.
    await getPrisma().session.deleteMany({ where: { userId: user.id } });
    await getPrisma().auditLog.create({
      data: {
        actorId: user.id,
        entityId: user.id,
        entityType: "user",
        action: "auth.supabase.password_reset_completed",
      },
    });
    await client.auth.signOut({ scope: "global" });
    await destroySession();
  } catch (error) {
    unstable_rethrow(error);
    report(error, "reset");
    return {
      status: "error",
      message:
        "Password reset could not finish. Request a new recovery link and try again.",
    };
  }
  redirect("/sign-in?passwordReset=1");
}
