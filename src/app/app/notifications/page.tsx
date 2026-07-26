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
import {
  markAllNotificationsAsReadAction,
  markNotificationAsReadAction,
  markNotificationAsUnreadAction,
  openNotificationAction,
} from "@/features/notifications/actions";
import {
  acceptConnectionAction,
  rejectConnectionAction,
} from "@/features/network/actions";
import { requireUser } from "@/lib/auth/session";
import { getPrisma } from "@/lib/db/prisma";
import {
  resolveNotificationAction,
  type NotificationActionResolution,
} from "@/lib/notifications/action-url";

const filters = [
  { label: "All", value: "" },
  { label: "Unread", value: "unread" },
  { label: "Messages", value: "messages" },
  { label: "Connections", value: "connections" },
  { label: "Opportunities", value: "opportunities" },
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
  opportunities: ["OPPORTUNITY_RESPONSE", "PROPOSAL", "PROPOSAL_UPDATE", "REVIEW"],
  support: ["SUPPORT", "SUPPORT_REPLY"],
  system: ["BROADCAST", "MODERATION", "MODERATION_UPDATE", "SYSTEM"],
};

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; unavailable?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const activeFilter = filters.some((filter) => filter.value === params.type)
    ? params.type ?? ""
    : "";
  const typeFilter = activeFilter && activeFilter !== "unread" ? filterTypes[activeFilter] : undefined;

  const notifications = await getPrisma().notification.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    where: {
      userId: user.id,
      ...(activeFilter === "unread" ? { readAt: null } : {}),
      ...(typeFilter ? { type: { in: typeFilter as never[] } } : {}),
    },
  });

  const unreadCount = notifications.filter((notification) => !notification.readAt).length;
  const cards = await Promise.all(
    notifications.map(async (notification) => ({
      action: await resolveNotificationAction(user.id, notification),
      connectionRequest: await getConnectionRequestState(user.id, notification),
      notification,
    })),
  );

  return (
    <AppSection
      actions={
        unreadCount > 0 ? (
          <form action={markAllNotificationsAsReadAction}>
            <Button size="sm" type="submit" variant="secondary">
              Mark all as read
            </Button>
          </form>
        ) : null
      }
      description="Messages, connection requests, content activity, support updates, and trust events."
      title="Notifications"
    >
      <div className="grid gap-5">
        {params.unavailable === "1" ? (
          <Card className="border-[color:var(--px-warning)]/40 bg-amber-50 text-sm font-semibold text-amber-900">
            This item is no longer available.
          </Card>
        ) : null}

        <div className="dashboard-scroll flex gap-2 overflow-x-auto pb-1">
          {filters.map((filter) => (
            <ButtonLink
              href={filter.value ? `/app/notifications?type=${filter.value}` : "/app/notifications"}
              key={filter.value || "all"}
              size="sm"
              variant={activeFilter === filter.value ? "primary" : "secondary"}
            >
              {filter.label}
            </ButtonLink>
          ))}
        </div>

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
            body="New account, message, support and workflow updates will appear here."
            title="No notifications"
          />
        )}
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
  connectionRequest: Awaited<ReturnType<typeof getConnectionRequestState>>;
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
  const openAction = openNotificationAction.bind(null, notification.id);
  const markReadAction = markNotificationAsReadAction.bind(null, notification.id);
  const markUnreadAction = markNotificationAsUnreadAction.bind(null, notification.id);

  return (
    <Card
      className={`relative flex flex-col gap-4 overflow-hidden transition-colors sm:flex-row sm:items-start ${
        isUnread
          ? "border-[color:var(--px-primary)]/40 bg-[color:var(--px-primary-soft)]"
          : "bg-[color:var(--px-surface)]"
      }`}
    >
      {canOpen ? (
        <form action={openAction} className="absolute inset-0 z-0">
          <button
            aria-label={`${action.label}: ${notification.title}`}
            className="h-full w-full cursor-pointer rounded-[var(--px-radius)] text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)]"
            type="submit"
          />
        </form>
      ) : null}

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
            <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full bg-[color:var(--px-warning)] ring-2 ring-[color:var(--px-surface)]" />
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
          {!action.available && action.reason !== "missing" ? (
            <p className="mt-2 text-xs font-bold text-[color:var(--px-warning)]">
              {action.label}
            </p>
          ) : null}
          <p className="mt-2 text-xs text-[color:var(--px-text-muted)]">
            {notification.createdAt.toLocaleString()}
          </p>
        </div>
      </div>

      <div className="relative z-20 flex flex-wrap gap-2 sm:justify-end">
        {connectionRequest?.profileHref ? (
          <ButtonLink href={connectionRequest.profileHref} size="sm" variant="secondary">
            View profile
          </ButtonLink>
        ) : null}
        {connectionRequest?.status === "PENDING" ? (
          <>
            <form action={acceptConnectionAction.bind(null, connectionRequest.id)}>
              <Button size="sm" type="submit">
                Accept
              </Button>
            </form>
            <form action={rejectConnectionAction.bind(null, connectionRequest.id)}>
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
          <form action={openAction}>
            <Button size="sm" type="submit" variant="secondary">
              {action.label}
            </Button>
          </form>
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
  if (["CONNECTION", "CONNECTION_REQUEST_ACCEPTED", "CONNECTION_REQUEST_DECLINED", "CONNECTION_REQUEST_RECEIVED"].includes(type)) {
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

async function getConnectionRequestState(userId: string, notification: {
  actionState: string | null;
  metadata: unknown;
  type: string;
}) {
  if (notification.type !== "CONNECTION_REQUEST_RECEIVED") return null;
  const connectionId = getConnectionId(notification.metadata);
  const actorId = getActorId(notification.metadata);

  const connection = await getPrisma().connection.findFirst({
    select: {
      id: true,
      requester: { select: { username: true } },
      status: true,
    },
    where: {
      receiverId: userId,
      ...(connectionId
        ? { id: connectionId }
        : actorId
          ? { requesterId: actorId }
          : { id: "__missing__" }),
    },
  });

  if (!connection) return null;

  return {
    id: connection.id,
    profileHref: connection.requester.username ? `/u/${connection.requester.username}` : null,
    status: notification.actionState ?? connection.status,
  };
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
