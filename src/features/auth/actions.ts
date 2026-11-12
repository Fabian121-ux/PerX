"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";

import { getPrisma } from "@/lib/db/prisma";
import { evaluateAccountAccess } from "@/lib/account/enforcement";
import { writeAuditLog } from "@/lib/logging/audit";
import {
  createSession,
  destroySession,
  getCurrentUser,
} from "@/lib/auth/session";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import {
  getResolvedDataMode,
  getSignupConfig,
  hasDatabaseUrl,
  isProductionMockModeError,
} from "@/lib/env";
import { getSafeAuthRedirect } from "@/lib/auth/redirects";
import { classifyError } from "@/lib/errors/taxonomy";
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
import {
  createEmailVerificationToken,
  EMAIL_VERIFICATION_RATE_WINDOW_MINUTES,
  EMAIL_VERIFICATION_TOKEN_TTL_HOURS,
  hashEmailVerificationToken,
  MAX_EMAIL_VERIFICATION_REQUESTS_PER_WINDOW,
} from "@/lib/auth/email-verification";
import {
  deliverEmailVerification,
  isEmailVerificationDeliveryConfigured,
} from "@/lib/auth/email-verification-delivery";

export type AuthFormState = {
  fieldErrors?: Record<string, string>;
  message?: string;
  status: "idle" | "error";
  values?: Record<string, string>;
};

export type EmailVerificationFormState = {
  fieldErrors?: Record<string, string>;
  message?: string;
  status: "idle" | "error" | "success";
};

const minimumMembershipRole = {
  MEMBER: {
    description: "Basic PtahX account membership.",
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

type PendingEmailVerification = {
  email: string;
  expiresAt: Date;
  token: string;
} | null;

/** Schedule email work after the response and log only redacted delivery metadata. */
function scheduleEmailVerificationDelivery(
  pendingDelivery: PendingEmailVerification,
  route: "/sign-up" | "/verify-email",
) {
  after(async () => {
    if (!pendingDelivery) return;
    try {
      const outcome = await deliverEmailVerification(pendingDelivery);
      console.info("[ptahx:email-verification-delivery]", {
        provider: outcome.provider,
        reason: "reason" in outcome ? outcome.reason : undefined,
        route,
        status: outcome.status,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("[ptahx:email-verification-delivery]", {
        kind: classifyError(error),
        reason: "unknown",
        route,
        status: "failed",
        timestamp: new Date().toISOString(),
      });
    }
  });
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

  // Never create a public account that cannot receive its activation link.
  if (!isEmailVerificationDeliveryConfigured()) {
    return {
      message: "Email verification is temporarily unavailable. Please try again later.",
      status: "error",
      values,
    };
  }

  const passwordHash = await hashPassword(parsed.data.password);

  let createdUserId: string;
  let pendingVerification: Exclude<PendingEmailVerification, null>;
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
          emailVerifiedAt: null,
          verificationStatus: "PENDING",
          name: parsed.data.name,
          passwordHash,
          username: parsed.data.username,
          profile: {
            create: {
              biography: "Profile setup is in progress.",
              headline: "New PtahX member",
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

      const token = createEmailVerificationToken();
      const expiresAt = new Date(
        Date.now() + EMAIL_VERIFICATION_TOKEN_TTL_HOURS * 60 * 60 * 1000,
      );
      await tx.emailVerificationToken.create({
        data: {
          expiresAt,
          tokenHash: hashEmailVerificationToken(token),
          userId: user.id,
        },
      });

      return {
        email: parsed.data.email,
        expiresAt,
        status: "created" as const,
        token,
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
    pendingVerification = {
      email: transactionResult.email,
      expiresAt: transactionResult.expiresAt,
      token: transactionResult.token,
    };
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

  await writeAuditLog({
    actorId: createdUserId,
    action: "auth.sign_up",
    entityId: createdUserId,
    entityType: "user",
  });
  scheduleEmailVerificationDelivery(pendingVerification, "/sign-up");
  redirect("/verify-email?status=sent");
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

  // Keep the existing internal administrator sign-in path intact. New public
  // accounts must confirm ownership of their email before authentication.
  if (
    !user.emailVerifiedAt &&
    user.accountClassification !== "INTERNAL_ADMIN"
  ) {
    return {
      message: "Verify your email address before signing in. You can request a new verification link below.",
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

export async function verifyEmailAction(
  _state: EmailVerificationFormState,
  formData: FormData,
): Promise<EmailVerificationFormState> {
  const token = formValue(formData, "token");
  if (!token || token.length > 256) {
    return { message: "This verification link is invalid or has expired.", status: "error" };
  }
  if (!hasDatabaseUrl()) {
    return { message: "Email verification is temporarily unavailable.", status: "error" };
  }

  const tokenHash = hashEmailVerificationToken(token);
  const now = new Date();
  try {
    const result = await getPrisma().$transaction(async (tx) => {
      const grant = await tx.emailVerificationToken.findUnique({
        select: { id: true, userId: true },
        where: { tokenHash },
      });
      if (!grant) return { ok: false as const };

      const claimed = await tx.emailVerificationToken.updateMany({
        data: { consumedAt: now },
        where: {
          consumedAt: null,
          expiresAt: { gt: now },
          id: grant.id,
        },
      });
      if (!claimed.count) {
        const existing = await tx.user.findUnique({
          select: { emailVerifiedAt: true },
          where: { id: grant.userId },
        });
        return existing?.emailVerifiedAt
          ? { ok: true as const, userId: grant.userId, alreadyVerified: true }
          : { ok: false as const };
      }

      await tx.user.update({
        data: {
          emailVerifiedAt: now,
          verificationStatus: "VERIFIED",
        },
        where: { id: grant.userId },
      });
      await tx.emailVerificationToken.updateMany({
        data: { consumedAt: now },
        where: {
          consumedAt: null,
          userId: grant.userId,
        },
      });
      return { ok: true as const, userId: grant.userId, alreadyVerified: false };
    });

    if (!result.ok) {
      return { message: "This verification link is invalid or has expired. Request a new one below.", status: "error" };
    }

    if (!result.alreadyVerified) {
      await writeAuditLog({
        action: "auth.email_verified",
        actorId: result.userId,
        entityId: result.userId,
        entityType: "user",
      });
    }
    redirect("/sign-in?verified=1");
  } catch (error) {
    // Next redirect throws a control-flow exception; let it pass through.
    if (error instanceof Error && error.message.startsWith("NEXT_REDIRECT")) throw error;
    logServerDataError({
      error,
      operation: "auth.email_verification",
      route: "/verify-email",
    });
    return { message: "We could not verify this email right now. Please try again.", status: "error" };
  }
}

/**
 * Resend a verification link without revealing whether an address is registered.
 * Three requests per account per 30 minutes are permitted.
 */
export async function resendEmailVerificationAction(
  _state: EmailVerificationFormState,
  formData: FormData,
): Promise<EmailVerificationFormState> {
  const parsed = emailSchema.safeParse(formData.get("email") ?? "");
  if (!parsed.success) {
    return {
      fieldErrors: { email: "Enter a valid email address." },
      message: "Check the email address and try again.",
      status: "error",
    };
  }

  let pendingDelivery: PendingEmailVerification = null;
  if (hasDatabaseUrl() && isEmailVerificationDeliveryConfigured()) {
    try {
      pendingDelivery = await getPrisma().$transaction(async (tx) => {
        const user = await tx.user.findUnique({
          select: { email: true, emailVerifiedAt: true, id: true, isActive: true },
          where: { email: parsed.data },
        });
        if (!user || !user.isActive || user.emailVerifiedAt) return null;

        const windowStart = new Date(
          Date.now() - EMAIL_VERIFICATION_RATE_WINDOW_MINUTES * 60 * 1000,
        );
        const recentRequests = await tx.emailVerificationToken.count({
          where: {
            createdAt: { gt: windowStart },
            userId: user.id,
          },
        });
        if (recentRequests >= MAX_EMAIL_VERIFICATION_REQUESTS_PER_WINDOW) {
          return null;
        }

        const token = createEmailVerificationToken();
        const expiresAt = new Date(
          Date.now() + EMAIL_VERIFICATION_TOKEN_TTL_HOURS * 60 * 60 * 1000,
        );
        await tx.emailVerificationToken.updateMany({
          data: { consumedAt: new Date() },
          where: { consumedAt: null, userId: user.id },
        });
        await tx.emailVerificationToken.create({
          data: {
            expiresAt,
            tokenHash: hashEmailVerificationToken(token),
            userId: user.id,
          },
        });
        return { email: user.email, expiresAt, token };
      });
    } catch (error) {
      logServerDataError({
        error,
        operation: "auth.email_verification.resend",
        route: "/verify-email",
      });
    }
  }

  // Same response and same scheduling shape for existing and unknown addresses.
  scheduleEmailVerificationDelivery(pendingDelivery, "/verify-email");
  return {
    message: "If this email belongs to an active account that still needs verification, a new link will be sent.",
    status: "success",
  };
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

  /*
   * Delivery work for THIS request, or null when there is nothing to send.
   *
   * Held in a local rather than sent immediately: the provider call is a
   * network round trip, and paying it here would mean only the known-account
   * branch was slow. That is the timing oracle the comment above warns about.
   */
  let pendingDelivery: {
    email: string;
    expiresAt: Date;
    resetUrl: string;
  } | null = null;

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
        pendingDelivery = {
          email: user.email,
          expiresAt: grant.expiresAt,
          resetUrl: buildPasswordResetUrl(grant.token),
        };
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

  /*
   * Registered unconditionally, on every request, including unknown addresses
   * and rate-limited ones. The callback decides whether there is work.
   *
   * Two reasons for the uniform shape. First, `after()` runs the callback once
   * the response is committed, so provider latency is outside the
   * request-response path entirely - verified in this runtime, not assumed.
   * Second, scheduling on every branch means the registration itself is not a
   * signal; an `after()` call that only happened for real accounts would
   * reintroduce the difference it exists to remove.
   *
   * Not a bare `void deliver(...)`: an untracked promise can be killed when a
   * serverless invocation is frozen after responding, losing the mail silently.
   */
  after(async () => {
    if (!pendingDelivery) return;
    try {
      const outcome =
        await passwordResetDelivery.deliverPasswordResetLink(pendingDelivery);
      // P0-1 log shape: status and safe provider identity only. No address, no
      // token, no reset URL - a log pipeline is not a place for a credential.
      console.info("[ptahx:password-reset-delivery]", {
        provider: outcome.provider,
        reason: "reason" in outcome ? outcome.reason : undefined,
        route: "/password-recovery",
        status: outcome.status,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      // A provider that throws despite the contract must not escape into the
      // request lifecycle. The error object itself is never logged: it can
      // carry the request URL and Authorization header.
      console.error("[ptahx:password-reset-delivery]", {
        kind: classifyError(error),
        reason: "unknown",
        route: "/password-recovery",
        status: "failed",
        timestamp: new Date().toISOString(),
      });
    }
  });

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
