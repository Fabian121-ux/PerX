import { AppSection } from "@/components/app-section";
import { Card, EmptyState } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/session";
import { getPrisma } from "@/lib/db/prisma";
import {
  markNotificationAsReadAction,
  markAllNotificationsAsReadAction,
} from "@/features/notifications/actions";
import {
  Bell,
  MessageSquare,
  FileText,
  Handshake,
  Star,
  ShieldAlert,
  HelpCircle,
  Users
} from "lucide-react";

export default async function NotificationsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const notifications = await getPrisma().notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const unreadCount = notifications.filter(n => !n.readAt).length;

  const getIcon = (type: string) => {
    switch (type) {
      case "MESSAGE": return <MessageSquare size={20} />;
      case "PROPOSAL": return <FileText size={20} />;
      case "DEAL": return <Handshake size={20} />;
      case "REVIEW": return <Star size={20} />;
      case "MODERATION": return <ShieldAlert size={20} />;
      case "SUPPORT": return <HelpCircle size={20} />;
      case "CONNECTION": return <Users size={20} />;
      default: return <Bell size={20} />;
    }
  };

  return (
    <AppSection
      title="Notifications"
      description="Updates on your proposals, agreements, messages, and security events."
      actions={
        unreadCount > 0 ? (
          <form action={markAllNotificationsAsReadAction}>
            <Button type="submit" variant="secondary" size="sm">
              Mark all as read
            </Button>
          </form>
        ) : null
      }
    >
      {notifications.length > 0 ? (
        <div className="grid gap-4">
          {notifications.map((notification) => {
            const isUnread = !notification.readAt;
            return (
              <Card
                key={notification.id}
                className={`flex flex-col gap-4 transition-colors sm:flex-row sm:items-start ${isUnread ? "border-[color:var(--px-primary)]/40 bg-[color:var(--px-primary-soft)]" : ""}`}
              >
                <div className="flex items-center gap-4 sm:flex-1">
                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${isUnread ? "bg-[color:var(--px-primary)] text-white" : "bg-[color:var(--px-muted)] text-[color:var(--px-text-muted)]"}`}>
                    {getIcon(notification.type)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className={`font-semibold ${isUnread ? "text-[color:var(--px-text)]" : "text-[color:var(--px-text-muted)]"}`}>
                      {notification.title}
                    </h3>
                    <p className={`mt-1 text-sm ${isUnread ? "text-[color:var(--px-text)]" : "text-[color:var(--px-text-muted)]"}`}>
                      {notification.body}
                    </p>
                    <p className="mt-2 text-xs text-[color:var(--px-text-muted)]">
                      {new Date(notification.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
                {isUnread && (
                  <form action={async () => { "use server"; await markNotificationAsReadAction(notification.id); }}>
                    <Button type="submit" variant="secondary" size="sm">
                      Mark read
                    </Button>
                  </form>
                )}
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title="No notifications"
          body="You're all caught up! New account and workflow notifications will appear here."
        />
      )}
    </AppSection>
  );
}
