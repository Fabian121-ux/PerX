import crypto from "node:crypto";

import { cache } from "react";
import { cookies, headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import type { RoleName } from "@/lib/permissions/capabilities";
import { hasCapability, type Capability } from "@/lib/permissions/capabilities";
import {
  evaluateAccountAccess,
  getAccountAccessPolicy,
} from "@/lib/account/enforcement";
import { getPrisma } from "@/lib/db/prisma";
import { getServerEnv, hasDatabaseUrl } from "@/lib/env";

export type CurrentUser = {
  id: string;
  email: string;
  emailVerifiedAt?: Date | null;
  name: string;
  username: string;
  roles: RoleName[];
  imageUrl?: string | null;
  onboardingDismissedAt?: Date | null;
  accountClassification?: string;
  verificationStatus?: string;
  createdAt?: Date;
  profile?: {
    headline: string;
    biography?: string;
    location?: string;
    profileImageUrl?: string | null;
    skills?: string[];
    averageRating?: number;
    completedDeals?: number;
    profileCompleteness: number;
    trustScore: number;
    isDiscoverable?: boolean;
    showLocation?: boolean;
    showSkills?: boolean;
    allowConnectionRequests?: boolean;
    allowMessagesFromConnections?: boolean;
    allowMessagesFromMembers?: boolean;
    showLastActiveTime?: boolean;
    showPresence?: boolean;
  } | null;
};

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function sessionCookieName() {
  return getServerEnv().SESSION_COOKIE_NAME;
}

export async function getCurrentSessionTokenHash() {
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookieName())?.value;
  return token ? hashToken(token) : null;
}

function secureSessionCookie() {
  return process.env.NODE_ENV === "production" || process.env.VERCEL === "1";
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
    secure: secureSessionCookie(),
  });
}

export async function createSession(userId: string) {
  const access = await getAccountAccessPolicy(userId);
  if (!access?.canAuthenticate) {
    throw new Error(access?.publicExplanation ?? "Account access is unavailable.");
  }
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
  cookieStore.set(sessionCookieName(), "", {
    httpOnly: true,
    maxAge: 0,
    path: "/",
    sameSite: "lax",
    secure: secureSessionCookie(),
  });
}

/**
 * Request-scoped memoization of the session lookup.
 *
 * Several server components in the same render tree (root layout, page,
 * site header, feature guards) each need the viewer. Without this the same
 * session + user + profile + roles join runs once per caller. `react.cache`
 * dedupes within a single request only, so it can never leak identity across
 * requests and can never serve stale authorization.
 */
async function loadCurrentUser(): Promise<CurrentUser | null> {
  if (!hasDatabaseUrl()) return null;

  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookieName())?.value;
  if (!token) return null;

  const session = await getPrisma().session.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      expiresAt: true,
      id: true,
      user: {
        select: {
           accountClassification: true,
           bannedAt: true,
           createdAt: true,
           connectionRequestsRestrictedUntil: true,
           deactivatedAt: true,
           email: true,
          emailVerifiedAt: true,
          id: true,
          imageUrl: true,
           isActive: true,
           enforcementReasonPublic: true,
           messagingRestrictedUntil: true,
          name: true,
          onboardingDismissedAt: true,
           profile: {
            select: {
              biography: true,
              averageRating: true,
              allowConnectionRequests: true,
              allowMessagesFromConnections: true,
              allowMessagesFromMembers: true,
              completedDeals: true,
              headline: true,
              location: true,
              isDiscoverable: true,
              profileCompleteness: true,
              profileImageUrl: true,
              showLastActiveTime: true,
              showLocation: true,
              showPresence: true,
              showSkills: true,
              skills: true,
              trustScore: true,
            },
          },
           roles: { include: { role: true } },
           publishingRestrictedUntil: true,
           suspendedAt: true,
           suspendedUntil: true,
          username: true,
          verificationStatus: true,
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

  const access = evaluateAccountAccess(
    {
      bannedAt: session.user.bannedAt,
      connectionRequestsRestrictedUntil:
        session.user.connectionRequestsRestrictedUntil,
      deactivatedAt: session.user.deactivatedAt,
      enforcementReasonPublic: session.user.enforcementReasonPublic,
      isActive: session.user.isActive,
      messagingRestrictedUntil: session.user.messagingRestrictedUntil,
      publishingRestrictedUntil: session.user.publishingRestrictedUntil,
      suspendedAt: session.user.suspendedAt,
      suspendedUntil: session.user.suspendedUntil,
      verificationStatus: session.user.verificationStatus,
    },
    new Date(),
  );
  if (!access.canAccessApplication) {
    await getPrisma().session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  return {
          email: session.user.email,
          emailVerifiedAt: session.user.emailVerifiedAt,
    id: session.user.id,
    name: session.user.name,
    onboardingDismissedAt: session.user.onboardingDismissedAt,
    username: session.user.username,
    imageUrl: session.user.imageUrl ?? session.user.profile?.profileImageUrl,
    accountClassification: session.user.accountClassification,
    verificationStatus: session.user.verificationStatus,
    createdAt: session.user.createdAt,
    profile: session.user.profile
      ? {
            averageRating: Number(session.user.profile.averageRating),
            allowConnectionRequests:
              session.user.profile.allowConnectionRequests,
            allowMessagesFromConnections:
              session.user.profile.allowMessagesFromConnections,
            allowMessagesFromMembers:
              session.user.profile.allowMessagesFromMembers,
            completedDeals: session.user.profile.completedDeals,
          headline: session.user.profile.headline,
          isDiscoverable: session.user.profile.isDiscoverable,
          biography: session.user.profile.biography,
          location: session.user.profile.location,
          profileImageUrl: session.user.profile.profileImageUrl,
          profileCompleteness: session.user.profile.profileCompleteness,
          skills: session.user.profile.skills.map((skill) => skill.name),
          showLastActiveTime: session.user.profile.showLastActiveTime,
          showLocation: session.user.profile.showLocation,
          showPresence: session.user.profile.showPresence,
          showSkills: session.user.profile.showSkills,
          trustScore: session.user.profile.trustScore,
        }
      : null,
    roles: session.user.roles.map((entry) => entry.role.name as RoleName),
  };
}

export const getCurrentUser: () => Promise<CurrentUser | null> =
  cache(loadCurrentUser);

export async function validateCurrentSessionAccess() {
  if (!hasDatabaseUrl()) return false;

  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookieName())?.value;
  if (!token) return false;

  const session = await getPrisma().session.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      expiresAt: true,
      id: true,
      user: {
        select: {
          bannedAt: true,
          connectionRequestsRestrictedUntil: true,
          deactivatedAt: true,
          enforcementReasonPublic: true,
          isActive: true,
          messagingRestrictedUntil: true,
          publishingRestrictedUntil: true,
          suspendedAt: true,
          suspendedUntil: true,
          verificationStatus: true,
        },
      },
    },
  });

  if (!session || session.expiresAt <= new Date()) {
    if (session) await getPrisma().session.delete({ where: { id: session.id } }).catch(() => {});
    return false;
  }

  const access = evaluateAccountAccess(session.user);
  if (!access.canAccessApplication) {
    await getPrisma().session.delete({ where: { id: session.id } }).catch(() => {});
    return false;
  }

  return true;
}

export async function touchCurrentSession() {
  if (!hasDatabaseUrl()) return false;

  if (!(await validateCurrentSessionAccess())) return false;
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookieName())?.value;
  if (!token) return false;

  const result = await getPrisma().session.updateMany({
    data: { lastSeenAt: new Date() },
    where: {
      expiresAt: { gt: new Date() },
      tokenHash: hashToken(token),
    },
  });

  return result.count > 0;
}

export async function requireUser(): Promise<NonNullable<CurrentUser>> {
  const user = await getCurrentUser();
  if (!user) {
    const cookieStore = await cookies();
    if (
      typeof cookieStore.has === "function" &&
      cookieStore.has(sessionCookieName())
    ) {
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

export async function requireCapabilityOrNotFound(capability: Capability) {
  const user = await getCurrentUser();
  if (!user || !hasCapability(user.roles, capability)) {
    notFound();
  }
  return user;
}
