import { getPrisma } from "@/lib/db/prisma";
import { roleLabels, type RoleName } from "@/lib/permissions/capabilities";
import {
  calculateTrustSummary,
  type PublicTrustSummary,
} from "@/lib/trust/engine";

export type PeopleSearchParams = {
  cursor?: string;
  location?: string;
  q?: string;
  role?: string;
  skill?: string;
};

export type PeopleDirectoryEntry = {
  canRequestConnection: boolean;
  canStartConversation: boolean;
  connectionDirection: "incoming" | "outgoing" | null;
  connectionId: string | null;
  connectionState: "NONE" | "PENDING" | "ACCEPTED" | "DECLINED" | "CANCELLED" | "BLOCKED";
  headline: string;
  id: string;
  imageUrl: string | null;
  isVerified: boolean;
  joinedAt: Date;
  location: string | null;
  name: string;
  presence: "hidden" | "online" | "recent" | "offline";
  roles: string[];
  skills: string[];
  trust: PublicTrustSummary;
  username: string;
};

type DiscoveryUser = {
  createdAt: Date;
  emailVerifiedAt: Date | null;
  id: string;
  imageUrl: string | null;
  name: string;
  profile: {
    allowConnectionRequests: boolean | null;
    allowMessagesFromConnections: boolean | null;
    averageRating: unknown;
    completedDeals: number | null;
    headline: string | null;
    isDiscoverable: boolean | null;
    location: string | null;
    profileCompleteness: number | null;
    profileImageUrl: string | null;
    showLocation: boolean | null;
    showPresence: boolean | null;
    showSkills: boolean | null;
    skills: { name: string }[];
  } | null;
  roles: { role: { label: string } }[];
  sessions: { lastSeenAt: Date | null }[];
  username: string;
  verificationStatus: string;
};

const pageSize = 24;

function normalizeFilter(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, 80) : undefined;
}

function getPresenceState(showPresence: boolean, lastSeenAt?: Date | null) {
  if (!showPresence || !lastSeenAt) return "hidden";
  const ageMs = Date.now() - lastSeenAt.getTime();
  if (ageMs <= 2 * 60_000) return "online";
  if (ageMs <= 30 * 60_000) return "recent";
  return "offline";
}

function mapDiscoveryUser(
  person: DiscoveryUser,
  viewerId?: string,
  connectionByUser = new Map<string, { requesterId: string; status: PeopleDirectoryEntry["connectionState"]; id: string }>(),
): PeopleDirectoryEntry {
  const connection = viewerId ? connectionByUser.get(person.id) : undefined;
  const accepted = connection?.status === "ACCEPTED";
  const messageAllowed =
    accepted && person.profile?.allowMessagesFromConnections;

  return {
    canRequestConnection:
      Boolean(viewerId) &&
      !connection &&
      Boolean(person.profile?.allowConnectionRequests),
    canStartConversation: Boolean(messageAllowed),
    connectionDirection:
      connection && viewerId
        ? connection.requesterId === viewerId
          ? "outgoing"
          : "incoming"
        : null,
    connectionId: connection?.id ?? null,
    connectionState: connection?.status ?? "NONE",
    headline: person.profile?.headline || "Profile not completed",
    id: person.id,
    imageUrl: person.imageUrl ?? person.profile?.profileImageUrl ?? null,
    isVerified: person.verificationStatus === "VERIFIED",
    joinedAt: person.createdAt,
    location:
      person.profile?.showLocation && person.profile.location
        ? person.profile.location
        : null,
    name: person.name,
    presence: getPresenceState(
      Boolean(person.profile?.showPresence),
      person.sessions[0]?.lastSeenAt ?? null,
    ),
    roles: person.roles.map((entry) => entry.role.label),
    skills:
      person.profile?.showSkills
        ? person.profile.skills.map((entry) => entry.name)
        : [],
    trust: calculateTrustSummary({
      averageRating: String(person.profile?.averageRating ?? 0),
      completedDeals: person.profile?.completedDeals ?? 0,
      emailVerifiedAt: person.emailVerifiedAt,
      profileCompleteness: person.profile?.profileCompleteness ?? 0,
      verificationStatus: person.verificationStatus,
    }),
    username: person.username,
  };
}

export async function getPeopleDirectory(
  viewerId: string,
  params: PeopleSearchParams = {},
) {
  const prisma = getPrisma();
  const q = normalizeFilter(params.q);
  const skill = normalizeFilter(params.skill);
  const location = normalizeFilter(params.location);
  const requestedRole = normalizeFilter(params.role)
    ?.toUpperCase()
    .replaceAll(" ", "_");
  const role =
    requestedRole && requestedRole in roleLabels
      ? (requestedRole as RoleName)
      : undefined;

  const blocked = await prisma.blockedUser.findMany({
    select: { blockedUserId: true, blockerUserId: true },
    where: {
      OR: [{ blockerUserId: viewerId }, { blockedUserId: viewerId }],
    },
  });
  const excludedIds = new Set([viewerId]);
  for (const block of blocked) {
    excludedIds.add(block.blockerUserId);
    excludedIds.add(block.blockedUserId);
  }

  const users = await prisma.user.findMany({
    cursor: params.cursor ? { id: params.cursor } : undefined,
    include: {
      profile: { include: { skills: { orderBy: { name: "asc" } } } },
      roles: { include: { role: true } },
      sessions: {
        orderBy: { lastSeenAt: "desc" },
        select: { lastSeenAt: true },
        take: 1,
      },
    },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    skip: params.cursor ? 1 : 0,
    take: pageSize + 1,
    where: {
      accountClassification: "PUBLIC_BETA_USER",
      id: { notIn: [...excludedIds] },
      isActive: true,
      profile: {
        is: {
          isDiscoverable: true,
          ...(location
            ? {
                showLocation: true,
                location: { contains: location, mode: "insensitive" },
              }
            : {}),
          ...(skill
            ? {
                showSkills: true,
                skills: { some: { name: { contains: skill, mode: "insensitive" } } },
              }
            : {}),
        },
      },
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { username: { contains: q, mode: "insensitive" } },
              {
                profile: {
                  is: { headline: { contains: q, mode: "insensitive" } },
                },
              },
            ],
          }
        : {}),
      ...(role
        ? {
            roles: {
              some: {
                role: {
                  name: role,
                },
              },
            },
          }
        : {}),
    },
  });

  const page = users.slice(0, pageSize);
  const userIds = page.map((user) => user.id);
  const connections = userIds.length
    ? await prisma.connection.findMany({
        where: {
          OR: [
            { requesterId: viewerId, receiverId: { in: userIds } },
            { requesterId: { in: userIds }, receiverId: viewerId },
          ],
        },
      })
    : [];

  const connectionByUser = new Map(
    connections.map((connection) => {
      const otherId =
        connection.requesterId === viewerId
          ? connection.receiverId
          : connection.requesterId;
      return [otherId, connection];
    }),
  );

  return {
    nextCursor: users.length > pageSize ? page.at(-1)?.id ?? null : null,
    people: page.map<PeopleDirectoryEntry>((person) =>
      mapDiscoveryUser(person, viewerId, connectionByUser),
    ),
  };
}

export async function getPublicPeopleDirectory(
  params: PeopleSearchParams = {},
  options: { limit?: number } = {},
) {
  const prisma = getPrisma();
  const q = normalizeFilter(params.q);
  const skill = normalizeFilter(params.skill);
  const location = normalizeFilter(params.location);
  const requestedRole = normalizeFilter(params.role)
    ?.toUpperCase()
    .replaceAll(" ", "_");
  const role =
    requestedRole && requestedRole in roleLabels
      ? (requestedRole as RoleName)
      : undefined;
  const take = Math.max(1, Math.min(options.limit ?? pageSize, 50));

  const users = await prisma.user.findMany({
    cursor: params.cursor ? { id: params.cursor } : undefined,
    include: {
      profile: { include: { skills: { orderBy: { name: "asc" } } } },
      roles: { include: { role: true } },
      sessions: {
        orderBy: { lastSeenAt: "desc" },
        select: { lastSeenAt: true },
        take: 1,
      },
    },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    skip: params.cursor ? 1 : 0,
    take: take + 1,
    where: {
      accountClassification: "PUBLIC_BETA_USER",
      isActive: true,
      profile: {
        is: {
          isDiscoverable: true,
          ...(location
            ? {
                showLocation: true,
                location: { contains: location, mode: "insensitive" },
              }
            : {}),
          ...(skill
            ? {
                showSkills: true,
                skills: {
                  some: { name: { contains: skill, mode: "insensitive" } },
                },
              }
            : {}),
        },
      },
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { username: { contains: q, mode: "insensitive" } },
              {
                profile: {
                  is: { headline: { contains: q, mode: "insensitive" } },
                },
              },
            ],
          }
        : {}),
      ...(role
        ? {
            roles: {
              some: {
                role: {
                  name: role,
                },
              },
            },
          }
        : {}),
    },
  });

  const page = users.slice(0, take);

  return {
    nextCursor: users.length > take ? page.at(-1)?.id ?? null : null,
    people: page.map<PeopleDirectoryEntry>((person) => mapDiscoveryUser(person)),
  };
}
