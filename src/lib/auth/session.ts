import crypto from "node:crypto";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import type { RoleName } from "@/lib/permissions/capabilities";
import { hasCapability, type Capability } from "@/lib/permissions/capabilities";
import { getPrisma } from "@/lib/db/prisma";
import { getServerEnv, hasDatabaseUrl } from "@/lib/env";

export type CurrentUser = {
  id: string;
  email: string;
  name: string;
  username: string;
  roles: RoleName[];
  profile?: {
    headline: string;
    trustScore: number;
    profileCompleteness: number;
  } | null;
};

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function sessionCookieName() {
  return getServerEnv().SESSION_COOKIE_NAME;
}

export async function createSession(userId: string) {
  const env = getServerEnv();
  const rawToken = crypto.randomBytes(32).toString("base64url");
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(
    Date.now() + env.AUTH_SESSION_DAYS * 24 * 60 * 60 * 1000,
  );
  const headerStore = await headers();

  await getPrisma().session.create({
    data: {
      expiresAt,
      tokenHash,
      userAgent: headerStore.get("user-agent"),
      userId,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(sessionCookieName(), rawToken, {
    httpOnly: true,
    maxAge: env.AUTH_SESSION_DAYS * 24 * 60 * 60,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

export async function destroySession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookieName())?.value;
  if (token && hasDatabaseUrl()) {
    await getPrisma().session.deleteMany({
      where: { tokenHash: hashToken(token) },
    });
  }
  cookieStore.delete(sessionCookieName());
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  if (!hasDatabaseUrl()) return null;

  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookieName())?.value;
  if (!token) return null;

  const session = await getPrisma().session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      user: {
        include: {
          profile: true,
          roles: { include: { role: true } },
        },
      },
    },
  });

  if (!session || session.expiresAt <= new Date() || !session.user.isActive) {
    return null;
  }

  return {
    email: session.user.email,
    id: session.user.id,
    name: session.user.name,
    profile: session.user.profile
      ? {
          headline: session.user.profile.headline,
          profileCompleteness: session.user.profile.profileCompleteness,
          trustScore: session.user.profile.trustScore,
        }
      : null,
    roles: session.user.roles.map((entry) => entry.role.name as RoleName),
    username: session.user.username,
  };
}

export async function requireUser(): Promise<NonNullable<CurrentUser>> {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in?next=/app");
  return user;
}

export async function requireCapability(capability: Capability) {
  const user = await requireUser();
  if (!hasCapability(user.roles, capability)) {
    redirect("/app?error=forbidden");
  }
  return user;
}
