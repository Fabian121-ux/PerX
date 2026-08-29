import {
  Bell,
  FileText,
  Handshake,
  HelpCircle,
  MessageSquare,
  ShieldAlert,
  Star,
  Users,
} from "lucide-react";

import { AppSection } from "@/components/app-section";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/card";
import { NotificationActionLink } from "@/components/notifications/notification-action-link";
import {
  markAllNotificationsAsReadAction,
  markNotificationAsReadAction,
  markNotificationAsUnreadAction,
} from "@/features/notifications/actions";
import {
  acceptConnectionAction,
  rejectConnectionAction,
} from "@/features/network/actions";
import { requireUser } from "@/lib/auth/session";
import { getPrisma } from "@/lib/db/prisma";
import { NOTIFICATION_PAGE_SIZE } from "@/lib/notifications/page-size";
import {
  resolveNotificationActions,
  type NotificationActionResolution,
} from "@/lib/notifications/action-url";
import {
  createCursorPage,
  normalizeCursorPageParams,
  withCursor,
} from "@/lib/data/cursor";
import type { Prisma } from "@/generated/prisma/client";

const filters = [
  { label: "All", value: "" },
  { label: "Unread", value: "unread" },
  { label: "Messages", value: "messages" },
  { label: "Connections", value: "connections" },
  { label: "Opportunities", value: "opportunities" },
  { label: "Reviews", value: "reviews" },
  { label: "Deals", value: "deals" },
  { label: "Support", value: "support" },
  { label: "System", value: "system" },
] as const;

const filterTypes: Record<string, string[]> = {
  connections: [
    "CONNECTION",
    "CONNECTION_REQUEST_ACCEPTED",
    "CONNECTION_REQUEST_DECLINED",
    "CONNECTION_REQUEST_RECEIVED",
  ],
  deals: ["DEAL", "DEAL_UPDATE"],
  messages: ["MESSAGE", "MESSAGE_REQUEST_RECEIVED", "NEW_MESSAGE"],
  opportunities: ["OPPORTUNITY_RESPONSE", "PROPOSAL", "PROPOSAL_UPDATE"],
  reviews: ["REVIEW"],
  support: ["SUPPORT", "SUPPORT_REPLY"],
  system: ["BROADCAST", "MODERATION", "MODERATION_UPDATE", "SYSTEM"],
};

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{
    cursor?: string;
    type?: string;
    unavailable?: string;
  }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const activeFilter = filters.some((filter) => filter.value === params.type)
    ? (params.type ?? "")
    : "";
  const typeFilter =
    activeFilter && activeFilter !== "unread"
      ? filterTypes[activeFilter]
      : undefined;
  const cursorScope = `notifications:${user.id}:${activeFilter || "all"}`;
  const { cursor, pageSize, requestedCursor } = normalizeCursorPageParams(
    { cursor: params.cursor, pageSize: NOTIFICATION_PAGE_SIZE },
    cursorScope,
  );
  const viewWhere: Prisma.NotificationWhereInput = {
    userId: user.id,
    ...(activeFilter === "unread" ? { readAt: null } : {}),
    ...(typeFilter ? { type: { in: typeFilter as never[] } } : {}),
  };
  const [notificationRows, totalUnreadCount, viewUnreadCount] =
    await Promise.all([
      getPrisma().notification.findMany({
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: pageSize + 1,
        where: withCursor<Prisma.NotificationWhereInput>(viewWhere, cursor, {
          direction: "desc",
          field: "createdAt",
        }),
      }),
      getPrisma().notification.count({
        where: { readAt: null, userId: user.id },
      }),
      activeFilter === "" || activeFilter === "unread"
        ? Promise.resolve(0)
        : getPrisma().notification.count({
            where: { ...viewWhere, readAt: null },
          }),
    ]);
  const hasNextPage = notificationRows.length > pageSize;
  const notifications = hasNextPage
    ? notificationRows.slice(0, pageSize)
    : notificationRows;
  const notificationPage = createCursorPage(notifications, {
    cursor: requestedCursor,
    getTimestamp: (notification) => notification.createdAt,
    hasNextPage,
    pageSize,
    scope: cursorScope,
  });
  const visibleUnreadCount =
    activeFilter === ""
      ? totalUnreadCount
      : activeFilter === "unread"
        ? notifications.length
        : viewUnreadCount;
  const activeFilterLabel =
    filters.find((filter) => filter.value === activeFilter)?.label ?? "All";
  const [actions, connectionRequests] = await Promise.all([
    resolveNotificationActions(user.id, notifications),
    getConnectionRequestStates(user.id, notifications),
  ]);
  const cards = notifications.map((notification) => ({
    action: actions.get(notification.id) ?? {
      available: false as const,
      href: null,
      label: "No action available",
      reason: "missing" as const,
    },
    connectionRequest: connectionRequests.get(notification.id) ?? null,
    notification,
  }));

  return (
    <AppSection
      actions={
        totalUnreadCount > 0 ? (
          <form action={markAllNotificationsAsReadAction}>
            <Button size="sm" type="submit" variant="secondary">
              Mark all account activity read
            </Button>
          </form>
        ) : null
      }
      description="Messages, connection requests, content activity, support updates, and trust events."
      title="Notifications"
    >
      <div className="mx-auto grid w-full max-w-5xl gap-5">
        {params.unavailable === "1" ? (
          <Card className="border-[color:var(--px-warning)]/40 bg-amber-50 text-sm font-semibold text-amber-900">
            This item is no longer available.
          </Card>
        ) : null}

        <Card className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[color:var(--px-primary-soft)] text-[color:var(--px-primary)]">
              <Bell aria-hidden size={20} />
            </span>
            <div>
              <p className="font-black text-[color:var(--px-text)]">
                {activeFilterLabel} activity
              </p>
              <p className="text-sm text-[color:var(--px-text-muted)]">
                {visibleUnreadCount
                  ? `${visibleUnreadCount} unread in this filter`
                  : "You are caught up in this view"}
              </p>
            </div>
          </div>
          <ButtonLink href="/app/news" size="sm" variant="ghost">
            Open PerX News
          </ButtonLink>
        </Card>

        <nav
          aria-label="Notification filters"
          className="dashboard-scroll flex gap-2 overflow-x-auto pb-1"
        >
          {filters.map((filter) => (
            <ButtonLink
              aria-current={activeFilter === filter.value ? "page" : undefined}
              href={
                filter.value
                  ? `/app/notifications?type=${filter.value}`
                  : "/app/notifications"
              }
              key={filter.value || "all"}
              size="sm"
              variant={activeFilter === filter.value ? "primary" : "secondary"}
            >
              {filter.label}
            </ButtonLink>
          ))}
        </nav>

        {notifications.length ? (
          <div className="grid gap-4">
            {cards.map(({ action, connectionRequest, notification }) => (
              <NotificationCard
                key={notification.id}
                action={action}
                connectionRequest={connectionRequest}
                notification={{
                  actionUrl: notification.actionUrl,
                  actionState: notification.actionState,
                  body: notification.body,
                  createdAt: notification.createdAt,
                  id: notification.id,
                  metadata: notification.metadata,
                  readAt: notification.readAt,
                  title: notification.title,
                  type: notification.type,
                }}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            action={
              activeFilter ? (
                <ButtonLink href="/app/notifications" variant="secondary">
                  View all activity
                </ButtonLink>
              ) : undefined
            }
            body={
              activeFilter
                ? `There are no ${activeFilterLabel.toLocaleLowerCase()} updates in this view.`
                : "New message, connection, support, and workflow updates will appear here."
            }
            title={
              activeFilter
                ? `No ${activeFilterLabel.toLocaleLowerCase()} activity`
                : "No notifications yet"
            }
          />
        )}
        {notificationPage.cursor || notificationPage.nextCursor ? (
          <nav
            aria-label="Notification pagination"
            className="flex items-center justify-between gap-3"
          >
            {notificationPage.cursor ? (
              <ButtonLink
                href={notificationPageHref(activeFilter)}
                variant="secondary"
              >
                Newer notifications
              </ButtonLink>
            ) : (
              <span />
            )}
            {notificationPage.nextCursor ? (
              <ButtonLink
                href={notificationPageHref(
                  activeFilter,
                  notificationPage.nextCursor,
                )}
                variant="secondary"
              >
                Older notifications
              </ButtonLink>
            ) : null}
          </nav>
        ) : null}
      </div>
    </AppSection>
  );
}

function NotificationCard({
  action,
  connectionRequest,
  notification,
}: {
  action: NotificationActionResolution;
  connectionRequest: {
    id: string;
    profileHref: string | null;
    status: string;
  } | null;
  notification: {
    actionUrl: string | null;
    actionState: string | null;
    body: string;
    createdAt: Date;
    id: string;
    metadata: unknown;
    readAt: Date | null;
    title: string;
    type: string;
  };
}) {
  const isUnread = !notification.readAt;
  const canOpen = action.available;
  const markReadAction = markNotificationAsReadAction.bind(
    null,
    notification.id,
  );
  const markUnreadAction = markNotificationAsUnreadAction.bind(
    null,
    notification.id,
  );

  return (
    <Card
      className={`relative flex flex-col gap-4 overflow-hidden border-l-4 transition-colors sm:flex-row sm:items-start ${
        isUnread
          ? "border-l-[color:var(--px-primary)] bg-[color:var(--px-primary-soft)]"
          : "border-l-transparent bg-[color:var(--px-surface)]"
      }`}
    >
      <div className="pointer-events-none relative z-10 flex min-w-0 flex-1 items-start gap-4">
        <div
          className={`relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${
            isUnread
              ? "bg-[color:var(--px-primary)] text-white"
              : "bg-[color:var(--px-muted)] text-[color:var(--px-text-muted)]"
          }`}
        >
          {getIcon(notification.type)}
          {isUnread ? (
            <span
              aria-hidden
              className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full bg-[color:var(--px-warning)] ring-2 ring-[color:var(--px-surface)]"
            />
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <h3
            className={`font-semibold ${
              isUnread
                ? "text-[color:var(--px-text)]"
                : "text-[color:var(--px-text-muted)]"
            }`}
          >
            <span className="sr-only">
              {isUnread ? "Unread" : "Read"} notification.{" "}
            </span>
            {notification.title}
          </h3>
          <p
            className={`mt-1 text-sm ${
              isUnread
                ? "text-[color:var(--px-text)]"
                : "text-[color:var(--px-text-muted)]"
            }`}
          >
            {notification.body}
          </p>
          {!action.available && action.label !== "No action available" ? (
            <p className="mt-2 text-xs font-bold text-[color:var(--px-warning)]">
              {action.label}
            </p>
          ) : null}
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[color:var(--px-text-muted)]">
            <time dateTime={notification.createdAt.toISOString()}>
              {notification.createdAt.toLocaleString()}
            </time>
            <span aria-hidden>·</span>
            <span>{notificationTypeLabel(notification.type)}</span>
          </div>
        </div>
      </div>

      <div className="relative z-20 flex flex-wrap gap-2 sm:justify-end">
        {connectionRequest?.profileHref ? (
          <ButtonLink
            href={connectionRequest.profileHref}
            size="sm"
            variant="secondary"
          >
            View profile
          </ButtonLink>
        ) : null}
        {connectionRequest?.status === "PENDING" ? (
          <>
            <form
              action={acceptConnectionAction.bind(null, connectionRequest.id)}
            >
              <Button size="sm" type="submit">
                Accept Connection
              </Button>
            </form>
            <form
              action={rejectConnectionAction.bind(null, connectionRequest.id)}
            >
              <Button size="sm" type="submit" variant="secondary">
                Decline
              </Button>
            </form>
          </>
        ) : null}
        {connectionRequest?.status === "ACCEPTED" ? (
          <span className="inline-flex min-h-9 items-center rounded-[var(--px-radius-sm)] bg-green-50 px-3 text-xs font-black text-green-800">
            Connected
          </span>
        ) : null}
        {connectionRequest?.status === "DECLINED" ? (
          <span className="inline-flex min-h-9 items-center rounded-[var(--px-radius-sm)] bg-[color:var(--px-muted)] px-3 text-xs font-black text-[color:var(--px-text-muted)]">
            Declined
          </span>
        ) : null}
        {canOpen ? (
          <NotificationActionLink
            className="inline-flex min-h-11 items-center rounded-[var(--px-radius-sm)] border border-[color:var(--px-border)] bg-[color:var(--px-surface)] px-3 text-sm font-bold text-[color:var(--px-text)] transition hover:bg-[color:var(--px-surface-soft)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)]"
            href={action.href!}
            notificationId={notification.id}
          >
            {action.label}
          </NotificationActionLink>
        ) : null}
        {isUnread ? (
          <form action={markReadAction}>
            <Button size="sm" type="submit" variant="secondary">
              Mark read
            </Button>
          </form>
        ) : (
          <form action={markUnreadAction}>
            <Button size="sm" type="submit" variant="secondary">
              Mark unread
            </Button>
          </form>
        )}
      </div>
    </Card>
  );
}

function getIcon(type: string) {
  if (["MESSAGE", "MESSAGE_REQUEST_RECEIVED", "NEW_MESSAGE"].includes(type)) {
    return <MessageSquare aria-hidden size={20} />;
  }
  if (
    [
      "CONNECTION",
      "CONNECTION_REQUEST_ACCEPTED",
      "CONNECTION_REQUEST_DECLINED",
      "CONNECTION_REQUEST_RECEIVED",
    ].includes(type)
  ) {
    return <Users aria-hidden size={20} />;
  }
  if (["PROPOSAL", "PROPOSAL_UPDATE", "OPPORTUNITY_RESPONSE"].includes(type)) {
    return <FileText aria-hidden size={20} />;
  }
  if (["DEAL", "DEAL_UPDATE"].includes(type)) {
    return <Handshake aria-hidden size={20} />;
  }
  if (type === "REVIEW") return <Star aria-hidden size={20} />;
  if (["MODERATION", "MODERATION_UPDATE"].includes(type)) {
    return <ShieldAlert aria-hidden size={20} />;
  }
  if (["SUPPORT", "SUPPORT_REPLY"].includes(type)) {
    return <HelpCircle aria-hidden size={20} />;
  }
  return <Bell aria-hidden size={20} />;
}

function notificationTypeLabel(type: string) {
  if (["MESSAGE", "MESSAGE_REQUEST_RECEIVED", "NEW_MESSAGE"].includes(type)) {
    return "Message";
  }
  if (type.startsWith("CONNECTION")) return "Connection";
  if (["PROPOSAL", "PROPOSAL_UPDATE", "OPPORTUNITY_RESPONSE"].includes(type)) {
    return "Opportunity";
  }
  if (["DEAL", "DEAL_UPDATE"].includes(type)) return "Deal";
  if (["SUPPORT", "SUPPORT_REPLY"].includes(type)) return "Support";
  if (type === "REVIEW") return "Review";
  if (["MODERATION", "MODERATION_UPDATE"].includes(type)) {
    return "Trust & safety";
  }
  if (type === "BROADCAST") return "PerX News";
  return "Account";
}

type NotificationConnectionCandidate = {
  id: string;
  actionState: string | null;
  metadata: unknown;
  type: string;
};

async function getConnectionRequestStates(
  userId: string,
  notifications: readonly NotificationConnectionCandidate[],
) {
  const candidates = notifications.filter(
    (notification) => notification.type === "CONNECTION_REQUEST_RECEIVED",
  );
  if (!candidates.length) return new Map();
  const connectionIds = candidates
    .map((notification) => getConnectionId(notification.metadata))
    .filter(Boolean);
  const actorIds = candidates
    .map((notification) => getActorId(notification.metadata))
    .filter(Boolean);

  const connections = await getPrisma().connection.findMany({
    select: {
      id: true,
      requesterId: true,
      requester: { select: { username: true } },
      status: true,
    },
    where: {
      receiverId: userId,
      OR: [
        ...(connectionIds.length ? [{ id: { in: connectionIds } }] : []),
        ...(actorIds.length ? [{ requesterId: { in: actorIds } }] : []),
      ],
    },
  });
  const byId = new Map(
    connections.map((connection) => [connection.id, connection]),
  );
  const byRequester = new Map(
    connections.map((connection) => [connection.requesterId, connection]),
  );
  return new Map(
    candidates.flatMap((notification) => {
      const connectionId = getConnectionId(notification.metadata);
      const actorId = getActorId(notification.metadata);
      const connection = connectionId
        ? byId.get(connectionId)
        : actorId
          ? byRequester.get(actorId)
          : null;
      return connection
        ? [
            [
              notification.id,
              {
                id: connection.id,
                profileHref: connection.requester.username
                  ? `/u/${connection.requester.username}`
                  : null,
                status: connection.status,
              },
            ] as const,
          ]
        : [];
    }),
  );
}

function notificationPageHref(type: string, cursor?: string | null) {
  const query = new URLSearchParams();
  if (type) query.set("type", type);
  if (cursor) query.set("cursor", cursor);
  const value = query.toString();
  return value ? `/app/notifications?${value}` : "/app/notifications";
}

function getConnectionId(metadata: unknown) {
  if (!metadata || typeof metadata !== "object") return "";
  const value = (metadata as { connectionId?: unknown }).connectionId;
  return typeof value === "string" ? value : "";
}

function getActorId(metadata: unknown) {
  if (!metadata || typeof metadata !== "object") return "";
  const value = (metadata as { actorId?: unknown }).actorId;
  return typeof value === "string" ? value : "";
}
