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
  openNotificationAction,
} from "@/features/notifications/actions";
import {
  acceptConnectionAction,
  rejectConnectionAction,
} from "@/features/network/actions";
import { requireUser } from "@/lib/auth/session";
import { getPrisma } from "@/lib/db/prisma";

const filters = [
  { label: "All", value: "" },
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
  system: ["MODERATION", "MODERATION_UPDATE", "SYSTEM"],
};

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const activeFilter = filters.some((filter) => filter.value === params.type)
    ? params.type ?? ""
    : "";
  const typeFilter = activeFilter ? filterTypes[activeFilter] : undefined;

  const notifications = await getPrisma().notification.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    where: {
      userId: user.id,
      ...(typeFilter ? { type: { in: typeFilter as never[] } } : {}),
    },
  });

  const unreadCount = notifications.filter((notification) => !notification.readAt).length;

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
            {notifications.map((notification) => (
              <NotificationCard
                key={notification.id}
                notification={{
                  actionUrl: notification.actionUrl,
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
  notification,
}: {
  notification: {
    actionUrl: string | null;
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
  const connectionId = getConnectionId(notification.metadata);
  const isIncomingConnection =
    notification.type === "CONNECTION_REQUEST_RECEIVED" && connectionId;

  return (
    <Card
      className={`flex flex-col gap-4 transition-colors sm:flex-row sm:items-start ${
        isUnread
          ? "border-[color:var(--px-primary)]/40 bg-[color:var(--px-primary-soft)]"
          : ""
      }`}
    >
      <div className="flex min-w-0 flex-1 items-start gap-4">
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${
            isUnread
              ? "bg-[color:var(--px-primary)] text-white"
              : "bg-[color:var(--px-muted)] text-[color:var(--px-text-muted)]"
          }`}
        >
          {getIcon(notification.type)}
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
          <p className="mt-2 text-xs text-[color:var(--px-text-muted)]">
            {notification.createdAt.toLocaleString()}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 sm:justify-end">
        {isIncomingConnection ? (
          <>
            <form action={async () => { "use server"; await acceptConnectionAction(connectionId); }}>
              <Button size="sm" type="submit">
                Accept
              </Button>
            </form>
            <form action={async () => { "use server"; await rejectConnectionAction(connectionId); }}>
              <Button size="sm" type="submit" variant="secondary">
                Decline
              </Button>
            </form>
          </>
        ) : null}
        {notification.actionUrl ? (
          <form action={async () => { "use server"; await openNotificationAction(notification.id); }}>
            <Button size="sm" type="submit" variant="secondary">
              Open
            </Button>
          </form>
        ) : null}
        {isUnread ? (
          <form action={async () => { "use server"; await markNotificationAsReadAction(notification.id); }}>
            <Button size="sm" type="submit" variant="secondary">
              Mark read
            </Button>
          </form>
        ) : null}
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

function getConnectionId(metadata: unknown) {
  if (!metadata || typeof metadata !== "object") return "";
  const value = (metadata as { connectionId?: unknown }).connectionId;
  return typeof value === "string" ? value : "";
}
