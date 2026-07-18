"use server";

import { redirect } from "next/navigation";

import { getPrisma } from "@/lib/db/prisma";
import { writeAuditLog } from "@/lib/logging/audit";
import {
  createSession,
  createSessionRecord,
  destroySession,
  setSessionCookie,
} from "@/lib/auth/session";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import {
  getResolvedDataMode,
  hasDatabaseUrl,
  isProductionMockModeError,
} from "@/lib/env";
import { getSafeAuthRedirect } from "@/lib/auth/redirects";
import { logServerDataError } from "@/lib/logging/runtime";
import { signInSchema, signUpSchema } from "@/lib/validation/auth";

export type AuthFormState = {
  fieldErrors?: Record<string, string>;
  message?: string;
  status: "idle" | "error";
  values?: Record<string, string>;
};

const baselineRoleDetails = {
  CLIENT: {
    description: "Publishes opportunities and accepts proposals.",
    label: "Client",
  },
  FREELANCER: {
    description: "Sells skilled delivery capacity.",
    label: "Freelancer",
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
  const mode = getAuthDataMode("/sign-up");

  if (mode === "mock") redirect("/app/profile/setup?mock=true");
  if (mode === "unavailable" || !hasDatabaseUrl()) {
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

  const passwordHash = await hashPassword(parsed.data.password);

  let createdUserId: string;
  let sessionCookie: Awaited<ReturnType<typeof createSessionRecord>>;
  try {
    const prisma = getPrisma();
    const existing = await prisma.user.findFirst({
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
        status: "error",
        values,
      };
    }

    if (existing?.username === parsed.data.username) {
      return {
        fieldErrors: { username: "This username is already taken." },
        message: "Please choose another username.",
        status: "error",
        values,
      };
    }

    const transactionResult = await prisma.$transaction(async (tx) => {
      const baselineRoles = await Promise.all(
        Object.entries(baselineRoleDetails).map(
          ([name, details]) =>
            tx.role.upsert({
              create: {
                description: details.description,
                label: details.label,
                name: name as keyof typeof baselineRoleDetails,
              },
              update: {},
              where: { name: name as keyof typeof baselineRoleDetails },
            }),
        ),
      );

      const user = await tx.user.create({
        data: {
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
            create: baselineRoles.map((role) => ({ roleId: role.id })),
          },
        },
        select: { id: true },
      });

      const nextSessionCookie = await createSessionRecord(user.id, tx);
      return { sessionCookie: nextSessionCookie, userId: user.id };
    });

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

  if (!user.isActive) {
    return {
      message: "This account is deactivated. Contact support if you believe this is a mistake.",
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
