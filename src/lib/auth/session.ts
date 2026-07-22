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
  imageUrl?: string | null;
  accountClassification?: string;
  verificationStatus?: string;
  createdAt?: Date;
  profile?: {
    headline: string;
    biography?: string;
    location?: string;
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

type SessionCookie = {
  maxAge: number;
  name: string;
  value: string;
};

type SessionWriter = Pick<ReturnType<typeof getPrisma>, "session">;

export async function createSessionRecord(
  userId: string,
  client: SessionWriter = getPrisma(),
): Promise<SessionCookie> {
  const env = getServerEnv();
  const rawToken = crypto.randomBytes(32).toString("base64url");
  const tokenHash = hashToken(rawToken);
  const maxAge = env.AUTH_SESSION_DAYS * 24 * 60 * 60;
  const expiresAt = new Date(
    Date.now() + maxAge * 1000,
  );
  const headerStore = await headers();

  await client.session.create({
    data: {
      expiresAt,
      tokenHash,
      userAgent: headerStore.get("user-agent"),
      userId,
    },
  });

  return {
    maxAge,
    name: sessionCookieName(),
    value: rawToken,
  };
}

export async function setSessionCookie(sessionCookie: SessionCookie) {
  const cookieStore = await cookies();
  cookieStore.set(sessionCookie.name, sessionCookie.value, {
    httpOnly: true,
    maxAge: sessionCookie.maxAge,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

export async function createSession(userId: string) {
  const sessionCookie = await createSessionRecord(userId);
  await setSessionCookie(sessionCookie);
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
    if (session) {
      // Clear invalid session from DB
      await getPrisma().session.delete({ where: { id: session.id } });
    }
    return null;
  }

  return {
    email: session.user.email,
    id: session.user.id,
    name: session.user.name,
    username: session.user.username,
    imageUrl: session.user.imageUrl,
    accountClassification: session.user.accountClassification,
    verificationStatus: session.user.verificationStatus,
    createdAt: session.user.createdAt,
    profile: session.user.profile
      ? {
          headline: session.user.profile.headline,
          biography: session.user.profile.biography,
          location: session.user.profile.location,
          profileCompleteness: session.user.profile.profileCompleteness,
          trustScore: session.user.profile.trustScore,
        }
      : null,
    roles: session.user.roles.map((entry) => entry.role.name as RoleName),
  };
}

export async function requireUser(): Promise<NonNullable<CurrentUser>> {
  const user = await getCurrentUser();
  if (!user) {
    const cookieStore = await cookies();
    if (cookieStore.has(sessionCookieName())) {
      redirect("/api/auth/clear-session?next=/app");
    }
    redirect("/sign-in?next=/app");
  }
  return user;
}

export async function requireCapability(capability: Capability) {
  const user = await requireUser();
  if (!hasCapability(user.roles, capability)) {
    redirect("/app?error=forbidden");
  }
  return user;
}
