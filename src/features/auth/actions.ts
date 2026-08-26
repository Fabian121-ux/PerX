"use server";

import { redirect } from "next/navigation";

import { getPrisma } from "@/lib/db/prisma";
import { evaluateAccountAccess } from "@/lib/account/enforcement";
import { writeAuditLog } from "@/lib/logging/audit";
import {
  createSession,
  createSessionRecord,
  destroySession,
  getCurrentUser,
  setSessionCookie,
} from "@/lib/auth/session";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import {
  getResolvedDataMode,
  getSignupConfig,
  hasDatabaseUrl,
  isProductionMockModeError,
} from "@/lib/env";
import { getSafeAuthRedirect } from "@/lib/auth/redirects";
import { logServerDataError } from "@/lib/logging/runtime";
import {
  checkRegistrationGate,
  REGISTRATION_CLOSED_MESSAGE,
} from "@/lib/registration/status";
import {
  emailSchema,
  passwordSchema,
  signInSchema,
  signUpSchema,
} from "@/lib/validation/auth";
import {
  consumePasswordResetToken,
  hasExceededResetRequestLimit,
  issuePasswordResetToken,
} from "@/lib/auth/password-reset";
import {
  buildPasswordResetUrl,
  passwordResetDelivery,
} from "@/lib/auth/password-reset-delivery";

export type AuthFormState = {
  fieldErrors?: Record<string, string>;
  message?: string;
  status: "idle" | "error";
  values?: Record<string, string>;
};

const minimumMembershipRole = {
  MEMBER: {
    description: "Basic PerX account membership.",
    label: "Member",
  },
} as const;

function formValue(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function getAuthDataMode(route: string) {
  try {
    return getResolvedDataMode();
  } catch (error) {
    if (isProductionMockModeError(error)) throw error;

    logServerDataError({
      error,
      operation: "auth.data_mode",
      route,
    });
    return "unavailable" as const;
  }
}

function getSignUpValues(formData: FormData) {
  return {
    email: formValue(formData, "email").toLowerCase(),
    name: formValue(formData, "name"),
    username: formValue(formData, "username").toLowerCase(),
  };
}

function getSignInValues(formData: FormData) {
  return {
    email: formValue(formData, "email").toLowerCase(),
  };
}

function validationErrors(error: { issues: { message: string; path: PropertyKey[] }[] }) {
  return error.issues.reduce<Record<string, string>>((errors, issue) => {
    const field = issue.path[0];
    if (typeof field === "string" && !errors[field]) {
      errors[field === "termsAccepted" ? "terms" : field] = issue.message;
    }
    return errors;
  }, {});
}

function addMockQuery(path: string) {
  return path.includes("?") ? `${path}&mock=true` : `${path}?mock=true`;
}

function duplicateTargetIncludes(
  error: unknown,
  field: "email" | "username",
) {
  const err = error as { code?: string; meta?: { target?: string | string[] } };
  if (err.code !== "P2002") return false;
  const target = err.meta?.target;
  return Array.isArray(target)
    ? target.includes(field)
    : typeof target === "string" && target.includes(field);
}

export async function signUpAction(
  _previousState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const values = getSignUpValues(formData);

  try {
    if (getSignupConfig().mode === "closed") {
      return {
        message: REGISTRATION_CLOSED_MESSAGE,
        status: "error",
        values,
      };
    }
  } catch (error) {
    logServerDataError({
      error,
      operation: "auth.signup_config",
      route: "/sign-up",
    });
    return {
      message: "Account creation is temporarily unavailable. Please try again shortly.",
      status: "error",
      values,
    };
  }

  const parsed = signUpSchema.safeParse({
    confirmPassword: formData.get("confirmPassword"),
    email: formData.get("email"),
    name: formData.get("name"),
    password: formData.get("password"),
    termsAccepted: formData.get("terms") === "on",
    username: formData.get("username"),
  });

  if (!parsed.success) {
    return {
      fieldErrors: validationErrors(parsed.error),
      message: "Please check your details and try again.",
      status: "error",
      values,
    };
  }

  const mode = getAuthDataMode("/sign-up");

  if (mode === "mock") redirect("/app/profile/setup?mock=true");
  if (mode === "unavailable" || !hasDatabaseUrl()) {
    return {
      message: "Account creation is temporarily unavailable. Please try again shortly.",
      status: "error",
      values,
    };
  }

  const passwordHash = await hashPassword(parsed.data.password);

  let createdUserId: string;
  let sessionCookie: Awaited<ReturnType<typeof createSessionRecord>>;
  try {
    const prisma = getPrisma();
    const transactionResult = await prisma.$transaction(async (tx) => {
      const registrationGate = await checkRegistrationGate(
        tx as unknown as Parameters<typeof checkRegistrationGate>[0],
      );
      if (!registrationGate.allowed) {
        return {
          message: registrationGate.message,
          status: "registration-error" as const,
        };
      }

      const existing = await tx.user.findFirst({
        select: { email: true, username: true },
        where: {
          OR: [
            { email: parsed.data.email },
            { username: parsed.data.username },
          ],
        },
      });

      if (existing?.email === parsed.data.email) {
        return {
          fieldErrors: { email: "An account with this email already exists." },
          message: "Please use another email or sign in.",
          status: "field-error" as const,
        };
      }

      if (existing?.username === parsed.data.username) {
        return {
          fieldErrors: { username: "This username is already taken." },
          message: "Please choose another username.",
          status: "field-error" as const,
        };
      }

      const memberRole = await tx.role.upsert({
        create: {
          description: minimumMembershipRole.MEMBER.description,
          label: minimumMembershipRole.MEMBER.label,
          name: "MEMBER",
        },
        update: {},
        where: { name: "MEMBER" },
      });

      const user = await tx.user.create({
        data: {
          accountClassification: "PUBLIC_BETA_USER",
          email: parsed.data.email,
          name: parsed.data.name,
          passwordHash,
          username: parsed.data.username,
          profile: {
            create: {
              biography: "Profile setup is in progress.",
              headline: "New perX member",
              location: "Remote",
              profileCompleteness: 30,
            },
          },
          roles: {
            create: [{ roleId: memberRole.id }],
          },
        },
        select: { id: true },
      });

      const nextSessionCookie = await createSessionRecord(user.id, tx);
      return {
        sessionCookie: nextSessionCookie,
        status: "created" as const,
        userId: user.id,
      };
    });

    if (transactionResult.status === "registration-error") {
      return {
        message: transactionResult.message,
        status: "error",
        values,
      };
    }

    if (transactionResult.status === "field-error") {
      return {
        fieldErrors: transactionResult.fieldErrors as unknown as Record<
          string,
          string
        >,
        message: transactionResult.message,
        status: "error",
        values,
      };
    }

    createdUserId = transactionResult.userId;
    sessionCookie = transactionResult.sessionCookie;
  } catch (error: unknown) {
    if (duplicateTargetIncludes(error, "email")) {
      return {
        fieldErrors: { email: "An account with this email already exists." },
        message: "Please use another email or sign in.",
        status: "error",
        values,
      };
    }
    if (duplicateTargetIncludes(error, "username")) {
      return {
        fieldErrors: { username: "This username is already taken." },
        message: "Please choose another username.",
        status: "error",
        values,
      };
    }

    logServerDataError({
      error,
      operation: "auth.sign_up",
      route: "/sign-up",
    });
    return {
      message: "Account creation is temporarily unavailable. Please try again shortly.",
      status: "error",
      values,
    };
  }

  await setSessionCookie(sessionCookie);
  await writeAuditLog({
    actorId: createdUserId,
    action: "auth.sign_up",
    entityId: createdUserId,
    entityType: "user",
  });
  redirect("/app/profile/setup");
}

export async function signInAction(
  _previousState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const values = getSignInValues(formData);
  const nextPath = getSafeAuthRedirect(formData.get("next"));
  const mode = getAuthDataMode("/sign-in");

  if (mode === "mock") redirect(addMockQuery(nextPath));
  if (mode === "unavailable" || !hasDatabaseUrl()) {
    return {
      message: "The authentication service is temporarily unavailable. Please try again.",
      status: "error",
      values,
    };
  }

  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return {
      fieldErrors: validationErrors(parsed.error),
      message: "The email or password you entered is incorrect.",
      status: "error",
      values,
    };
  }

  let user;
  try {
    user = await getPrisma().user.findUnique({
      where: { email: parsed.data.email },
    });
  } catch (error: unknown) {
    logServerDataError({
      error,
      operation: "auth.sign_in.lookup",
      route: "/sign-in",
    });
    return {
      message: "The authentication service is temporarily unavailable. Please try again.",
      status: "error",
      values,
    };
  }

  if (
    !user ||
    !(await verifyPassword(parsed.data.password, user.passwordHash))
  ) {
    return {
      message: "The email or password you entered is incorrect.",
      status: "error",
      values,
    };
  }

  const access = evaluateAccountAccess(user);
  if (!access.canAuthenticate) {
    try {
      await writeAuditLog({
        action: "auth.sign_in_blocked_by_enforcement",
        actorId: user.id,
        entityId: user.id,
        entityType: "user",
        metadata: { reasonCode: access.reasonCode },
      });
    } catch {
      // A denied sign-in must not reveal internal audit infrastructure failures.
    }
    return {
      message:
        user.bannedAt || user.deactivatedAt
          ? "Access to this account is unavailable."
          : !user.isActive
            ? "This account is deactivated. Contact support if you believe this is a mistake."
            : access.publicExplanation ?? "This account is currently restricted.",
      status: "error",
      values,
    };
  }

  try {
    await createSession(user.id);
  } catch (error) {
    logServerDataError({
      error,
      operation: "auth.sign_in.session",
      route: "/sign-in",
    });
    return {
      message: "The authentication service is temporarily unavailable. Please try again.",
      status: "error",
      values,
    };
  }

  await writeAuditLog({
    actorId: user.id,
    action: "auth.sign_in",
    entityId: user.id,
    entityType: "user",
  });
  redirect(nextPath);
}

export async function signOutAction() {
  const user = await getCurrentUser().catch(() => null);
  await destroySession();
  await writeAuditLog({
    actorId: user?.id,
    action: "auth.sign_out",
    entityId: user?.id,
    entityType: "session",
  });
  redirect("/sign-in?signedOut=1");
}

/**
 * Request a password reset link.
 *
 * Always redirects to the same neutral confirmation, whether or not the email
 * belongs to an account. Any branch that redirected differently - or returned
 * faster - would turn this into an email-enumeration oracle.
 *
 * The previous implementation only wrote an audit row and reset nothing, so
 * password recovery was non-functional.
 */
export async function passwordRecoveryAction(formData: FormData) {
  const parsed = emailSchema.safeParse(formData.get("email") ?? "");

  if (parsed.success && hasDatabaseUrl()) {
    try {
      const user = await getPrisma().user.findUnique({
        select: { email: true, id: true, isActive: true },
        where: { email: parsed.data },
      });

      // Unknown address, deactivated account, or too many recent requests all
      // fall through to the same neutral response below.
      if (user?.isActive && !(await hasExceededResetRequestLimit(user.id))) {
        const grant = await issuePasswordResetToken({ userId: user.id });
        await passwordResetDelivery.deliverPasswordResetLink({
          email: user.email,
          expiresAt: grant.expiresAt,
          resetUrl: buildPasswordResetUrl(grant.token),
        });
        await writeAuditLog({
          action: "auth.password_reset_requested",
          actorId: user.id,
          entityId: user.id,
          entityType: "user",
        });
      }
    } catch (error) {
      // Never surface infrastructure failure to the requester: it would
      // distinguish "known account" from "unknown account".
      logServerDataError({
        error,
        operation: "auth.password_reset_request",
        route: "/password-recovery",
      });
    }
  }

  redirect("/password-recovery?status=requested");
}

export type PasswordResetFormState = {
  message?: string;
  status: "idle" | "error";
};

/**
 * Redeem a reset token and set a new password.
 *
 * The token is consumed atomically BEFORE the password is written, so a
 * replayed link cannot set a password twice. All existing sessions are then
 * destroyed: account recovery must evict an attacker who already holds a
 * stolen session cookie.
 */
export async function resetPasswordAction(
  _state: PasswordResetFormState,
  formData: FormData,
): Promise<PasswordResetFormState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (password !== confirmPassword) {
    return { message: "Passwords do not match.", status: "error" };
  }
  // Same policy as registration; see `passwordSchema`.
  const parsedPassword = passwordSchema.safeParse(password);
  if (!parsedPassword.success) {
    return {
      message: parsedPassword.error.issues[0]?.message ?? "Invalid password.",
      status: "error",
    };
  }
  if (!hasDatabaseUrl()) {
    return { message: "Password reset is unavailable.", status: "error" };
  }

  const consumed = await consumePasswordResetToken(token);
  if (!consumed.ok) {
    return {
      message: "This reset link is invalid or has expired.",
      status: "error",
    };
  }

  const passwordHash = await hashPassword(parsedPassword.data);
  await getPrisma().$transaction(async (tx) => {
    await tx.user.update({
      data: { passwordHash },
      where: { id: consumed.userId },
    });
    // Server-authoritative sign-out of every existing session.
    await tx.session.deleteMany({ where: { userId: consumed.userId } });
  });
  await writeAuditLog({
    action: "auth.password_reset_completed",
    actorId: consumed.userId,
    entityId: consumed.userId,
    entityType: "user",
  });

  redirect("/sign-in?passwordReset=1");
}
