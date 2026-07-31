import { ArrowUpRight, Megaphone } from "lucide-react";

import { AppSection } from "@/components/app-section";
import { NewsReadMarker } from "@/components/news/news-read-marker";
import { ButtonLink } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { getNewsForUser } from "@/lib/data/news";
import { normalizeNotificationActionUrl } from "@/lib/notifications/action-url";

export const dynamic = "force-dynamic";

export default async function NewsPage() {
  const user = await requireUser();
  const news = await getNewsForUser(user.id);
  const unreadIds = news
    .filter((item) => !item.readAt)
    .map((item) => item.notificationId);

  return (
    <AppSection
      description="Official announcements and platform updates from the PerX team."
      title="News"
    >
      <NewsReadMarker notificationIds={unreadIds} />

      {news.length ? (
        <div className="grid gap-4">
          {news.map((item) => {
            const actionUrl = normalizeNotificationActionUrl(item.actionUrl);
            const isUnread = !item.readAt;

            return (
              <Card
                className={`overflow-hidden ${
                  isUnread
                    ? "border-[color:var(--px-warning)]/50 bg-amber-50/70 dark:bg-amber-950/15"
                    : "bg-[color:var(--px-surface)]"
                }`}
                key={item.id}
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[color:var(--px-primary)] text-white shadow-[0_8px_20px_rgba(37,99,235,0.24)]">
                    <Megaphone aria-hidden size={21} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-black uppercase tracking-[0.12em] text-[color:var(--px-primary)]">
                        Official PerX News
                      </span>
                      {item.priority === "HIGH" ? (
                        <span className="rounded-full bg-[color:var(--px-warning)] px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-white">
                          Important
                        </span>
                      ) : null}
                      {isUnread ? (
                        <span className="rounded-full bg-[color:var(--px-primary-soft)] px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-[color:var(--px-primary)]">
                          New
                        </span>
                      ) : null}
                    </div>
                    <h2 className="mt-2 text-xl font-black text-[color:var(--px-text)]">
                      {item.title}
                    </h2>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[color:var(--px-text-muted)]">
                      {item.body}
                    </p>
                    <p className="mt-3 text-xs font-medium text-[color:var(--px-text-muted)]">
                      {item.sentAt.toLocaleString()}
                    </p>
                  </div>
                  {actionUrl && actionUrl !== "/app/news" ? (
                    <ButtonLink href={actionUrl} size="sm" variant="secondary">
                      Open update
                      <ArrowUpRight aria-hidden className="ml-1.5" size={14} />
                    </ButtonLink>
                  ) : null}
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState
          body="Official PerX announcements will appear here when they are published for your account."
          title="No News yet"
        />
      )}
    </AppSection>
  );
}
