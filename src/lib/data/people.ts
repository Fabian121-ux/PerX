import { getPrisma } from "@/lib/db/prisma";
import { roleLabels, type RoleName } from "@/lib/permissions/capabilities";

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
  roles: string[];
  skills: string[];
  trustScore: number;
  username: string;
};

const pageSize = 24;

function normalizeFilter(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, 80) : undefined;
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
    people: page.map<PeopleDirectoryEntry>((person) => {
      const connection = connectionByUser.get(person.id);
      const accepted = connection?.status === "ACCEPTED";
      const messageAllowed =
        accepted
          ? person.profile?.allowMessagesFromConnections
          : person.profile?.allowMessagesFromMembers;

      return {
        canRequestConnection:
          !connection && Boolean(person.profile?.allowConnectionRequests),
        canStartConversation: Boolean(messageAllowed),
        connectionDirection: connection
          ? connection.requesterId === viewerId
            ? "outgoing"
            : "incoming"
          : null,
        connectionId: connection?.id ?? null,
        connectionState: connection?.status ?? "NONE",
        headline: person.profile?.headline ?? "PerX member",
        id: person.id,
        imageUrl: person.imageUrl ?? person.profile?.profileImageUrl ?? null,
        isVerified: person.verificationStatus === "VERIFIED",
        joinedAt: person.createdAt,
        location:
          person.profile?.showLocation && person.profile.location
            ? person.profile.location
            : null,
        name: person.name,
        roles: person.roles.map((entry) => entry.role.label),
        skills:
          person.profile?.showSkills
            ? person.profile.skills.map((entry) => entry.name)
            : [],
        trustScore: person.profile?.trustScore ?? 0,
        username: person.username,
      };
    }),
  };
}
