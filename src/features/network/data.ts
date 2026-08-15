import type { Prisma } from "@/generated/prisma/client";
import type { ConnectionStatus, DealStatus } from "@/generated/prisma/enums";
import { getPrisma } from "@/lib/db/prisma";

import { getDiscoverableNetworkTargetWhere } from "./eligibility";
import type { ConnectionTab } from "./routes";

export const CONNECTION_DISCOVER_LIMIT = 24;
export const CONNECTION_RELATION_LIMIT = 50;
export const QUALIFYING_PARTNER_DEAL_STATUSES = [
  "APPROVED",
  "RELEASED",
] as const satisfies readonly DealStatus[];

export const CONNECTION_COPY = {
  accept: "Accept Connection",
  block: "Block",
  connect: "Connect With",
  connected: "Connected",
  decline: "Decline",
  message: "Message",
  remove: "Remove",
  report: "Report",
  requestSent: "Request sent",
} as const;

export type NetworkRelationshipState =
  | "AVAILABLE"
  | "BLOCKED"
  | "CONNECTED"
  | "PENDING_INCOMING"
  | "PENDING_OUTGOING";

export type NetworkEntry = {
  canMessage: boolean;
  canRequest: boolean;
  connectionId: string | null;
  headline: string;
  id: string;
  imageUrl: string | null;
  isPartner: boolean;
  name: string;
  relationship: NetworkRelationshipState;
  username: string;
  blockedAt?: Date | null;
};

const publicNetworkUserSelect = {
  id: true,
  imageUrl: true,
  name: true,
  profile: {
    select: {
      allowConnectionRequests: true,
      allowMessagesFromConnections: true,
      headline: true,
      profileImageUrl: true,
    },
  },
  username: true,
} satisfies Prisma.UserSelect;

type PublicNetworkUser = Prisma.UserGetPayload<{
  select: typeof publicNetworkUserSelect;
}>;

type ActiveConnection = {
  id: string;
  receiverId: string;
  requesterId: string;
  status: ConnectionStatus;
};

export function normalizeConnectionsQuery(q?: string | string[]) {
  const value = Array.isArray(q) ? q[0] : q;
  const normalized = value?.trim();
  return normalized ? normalized.slice(0, 80) : undefined;
}

export function isEligiblePartnerDealStatus(status: DealStatus) {
  return QUALIFYING_PARTNER_DEAL_STATUSES.includes(
    status as (typeof QUALIFYING_PARTNER_DEAL_STATUSES)[number],
  );
}

export function derivePartnerUserIds(
  connectedUserIds: readonly string[],
  eligibleParticipantRows: readonly { userId: string }[],
) {
  const connectedIds = new Set(connectedUserIds);
  return new Set(
    eligibleParticipantRows
      .map((participant) => participant.userId)
      .filter((userId) => connectedIds.has(userId)),
  );
}

export function getConnectedLabel(isPartner: boolean) {
  return isPartner
    ? `${CONNECTION_COPY.connected} · Partner`
    : CONNECTION_COPY.connected;
}

function toNetworkEntry(
  person: PublicNetworkUser,
  relationship: NetworkRelationshipState,
  connectionId: string | null,
  partnerUserIds: ReadonlySet<string>,
  blockedAt: Date | null = null,
): NetworkEntry {
  return {
    canMessage:
      relationship === "CONNECTED" &&
      Boolean(person.profile?.allowMessagesFromConnections),
    canRequest:
      relationship === "AVAILABLE" &&
      Boolean(person.profile?.allowConnectionRequests),
    connectionId,
    headline: person.profile?.headline || "PerX member",
    id: person.id,
    imageUrl: person.imageUrl ?? person.profile?.profileImageUrl ?? null,
    isPartner: partnerUserIds.has(person.id),
    name: person.name,
    relationship,
    username: person.username,
    blockedAt,
  };
}

function otherUserId(connection: ActiveConnection, viewerId: string) {
  return connection.requesterId === viewerId
    ? connection.receiverId
    : connection.requesterId;
}

function connectionRank(connection: ActiveConnection) {
  return connection.status === "ACCEPTED" ? 2 : 1;
}

function indexActiveConnections(
  connections: ActiveConnection[],
  viewerId: string,
) {
  const byUserId = new Map<string, ActiveConnection>();
  for (const connection of connections) {
    const userId = otherUserId(connection, viewerId);
    const current = byUserId.get(userId);
    if (!current || connectionRank(connection) > connectionRank(current)) {
      byUserId.set(userId, connection);
    }
  }
  return byUserId;
}

async function getPartnerUserIds(viewerId: string, connectedUserIds: string[]) {
  if (!connectedUserIds.length) return new Set<string>();

  const rows = await getPrisma().dealParticipant.findMany({
    distinct: ["userId"],
    orderBy: { userId: "asc" },
    select: { userId: true },
    take: connectedUserIds.length,
    where: {
      deal: {
        participants: { some: { userId: viewerId } },
        status: { in: [...QUALIFYING_PARTNER_DEAL_STATUSES] },
      },
      userId: { in: connectedUserIds },
    },
  });

  return derivePartnerUserIds(connectedUserIds, rows);
}

async function getDiscoverEntries(viewerId: string, q?: string | string[]) {
  const prisma = getPrisma();
  const now = new Date();
  const normalizedQ = normalizeConnectionsQuery(q);
  const eligibleTargetWhere = getDiscoverableNetworkTargetWhere(viewerId, now);
  const people = await prisma.user.findMany({
    orderBy: [{ name: "asc" }, { id: "asc" }],
    select: publicNetworkUserSelect,
    take: CONNECTION_DISCOVER_LIMIT,
    where: {
      AND: [
        eligibleTargetWhere,
        ...(normalizedQ
          ? [
              {
                OR: [
                  {
                    name: {
                      contains: normalizedQ,
                      mode: "insensitive" as const,
                    },
                  },
                  {
                    username: {
                      contains: normalizedQ,
                      mode: "insensitive" as const,
                    },
                  },
                  {
                    profile: {
                      is: {
                        headline: {
                          contains: normalizedQ,
                          mode: "insensitive" as const,
                        },
                      },
                    },
                  },
                ],
              },
            ]
          : []),
      ],
    },
  });

  const personIds = people.map((person) => person.id);
  const connections: ActiveConnection[] = personIds.length
    ? await prisma.connection.findMany({
        orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
        select: {
          id: true,
          receiverId: true,
          requesterId: true,
          status: true,
        },
        take: personIds.length * 2,
        where: {
          OR: [
            { receiverId: { in: personIds }, requesterId: viewerId },
            { receiverId: viewerId, requesterId: { in: personIds } },
          ],
          status: { in: ["ACCEPTED", "PENDING"] },
        },
      })
    : [];
  const connectionByUserId = indexActiveConnections(connections, viewerId);
  const connectedUserIds = people
    .filter(
      (person) => connectionByUserId.get(person.id)?.status === "ACCEPTED",
    )
    .map((person) => person.id);
  const partnerUserIds = await getPartnerUserIds(viewerId, connectedUserIds);

  return people.map((person) => {
    const connection = connectionByUserId.get(person.id);
    const relationship = !connection
      ? "AVAILABLE"
      : connection.status === "ACCEPTED"
        ? "CONNECTED"
        : connection.requesterId === viewerId
          ? "PENDING_OUTGOING"
          : "PENDING_INCOMING";
    return toNetworkEntry(
      person,
      relationship,
      connection?.id ?? null,
      partnerUserIds,
    );
  });
}

async function getIncomingEntries(viewerId: string) {
  const eligibleTargetWhere = getDiscoverableNetworkTargetWhere(
    viewerId,
    new Date(),
  );
  const rows = await getPrisma().connection.findMany({
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    select: {
      id: true,
      requester: { select: publicNetworkUserSelect },
    },
    take: CONNECTION_RELATION_LIMIT,
    where: {
      receiverId: viewerId,
      requester: eligibleTargetWhere,
      status: "PENDING",
    },
  });

  return rows.map((row) =>
    toNetworkEntry(row.requester, "PENDING_INCOMING", row.id, new Set()),
  );
}

async function getSentEntries(viewerId: string) {
  const eligibleTargetWhere = getDiscoverableNetworkTargetWhere(
    viewerId,
    new Date(),
  );
  const rows = await getPrisma().connection.findMany({
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    select: {
      id: true,
      receiver: { select: publicNetworkUserSelect },
    },
    take: CONNECTION_RELATION_LIMIT,
    where: {
      receiver: eligibleTargetWhere,
      requesterId: viewerId,
      status: "PENDING",
    },
  });

  return rows.map((row) =>
    toNetworkEntry(row.receiver, "PENDING_OUTGOING", row.id, new Set()),
  );
}

async function getBlockedEntries(viewerId: string) {
  const rows = await getPrisma().blockedUser.findMany({
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    select: {
      blockedUser: { select: publicNetworkUserSelect },
      createdAt: true,
    },
    take: CONNECTION_RELATION_LIMIT,
    where: { blockerUserId: viewerId },
  });

  return rows.map((row) =>
    toNetworkEntry(row.blockedUser, "BLOCKED", null, new Set(), row.createdAt),
  );
}

async function getAcceptedEntries(viewerId: string) {
  const eligibleTargetWhere = getDiscoverableNetworkTargetWhere(
    viewerId,
    new Date(),
  );
  const rows = await getPrisma().connection.findMany({
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    select: {
      id: true,
      receiver: { select: publicNetworkUserSelect },
      receiverId: true,
      requester: { select: publicNetworkUserSelect },
      requesterId: true,
    },
    take: CONNECTION_RELATION_LIMIT,
    where: {
      OR: [
        { receiver: eligibleTargetWhere, requesterId: viewerId },
        { receiverId: viewerId, requester: eligibleTargetWhere },
      ],
      status: "ACCEPTED",
    },
  });
  const people = rows.map((row) =>
    row.requesterId === viewerId ? row.receiver : row.requester,
  );
  const partnerUserIds = await getPartnerUserIds(
    viewerId,
    people.map((person) => person.id),
  );

  return rows.map((row, index) =>
    toNetworkEntry(people[index]!, "CONNECTED", row.id, partnerUserIds),
  );
}

export async function getConnectionsTabData(
  viewerId: string,
  tab: ConnectionTab,
  params: { q?: string | string[] } = {},
) {
  if (tab === "requests") return getIncomingEntries(viewerId);
  if (tab === "sent") return getSentEntries(viewerId);
  if (tab === "connections") return getAcceptedEntries(viewerId);
  if (tab === "blocked") return getBlockedEntries(viewerId);
  return getDiscoverEntries(viewerId, params.q);
}
