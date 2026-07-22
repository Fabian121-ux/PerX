import Link from "next/link";
import { AppSection } from "@/components/app-section";
import { Card, EmptyState } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/session";
import { getPrisma } from "@/lib/db/prisma";
import {
  Briefcase,
  ClipboardList,
  Handshake,
  MessageSquare,
  Bookmark,
  ShieldCheck,
  CheckCircle2
} from "lucide-react";

export default async function ActivityDashboardPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const [
    listingsCount,
    proposalsSentCount,
    proposalsReceivedCount,
    activeDealsCount,
    completedDealsCount,
    savedItemsCount,
  ] = await Promise.all([
    getPrisma().opportunity.count({ where: { ownerId: user.id } }),
    getPrisma().proposal.count({ where: { senderId: user.id } }),
    getPrisma().proposal.count({ where: { opportunity: { ownerId: user.id } } }),
    getPrisma().dealParticipant.count({
      where: { userId: user.id, deal: { status: { in: ["IN_PROGRESS", "FUNDED", "AWAITING_FUNDING"] } } },
    }),
    getPrisma().dealParticipant.count({
      where: { userId: user.id, deal: { status: "RELEASED" } },
    }),
    getPrisma().opportunityBookmark.count({ where: { userId: user.id } }),
  ]);

  const actualUnreadCount = await getPrisma().message.count({
    where: {
      conversation: { participants: { some: { userId: user.id } } },
      senderId: { not: user.id },
      readReceipts: { none: { userId: user.id } }
    }
  });

  const trustScore = user.profile?.trustScore ?? 0;
  const profileCompleteness = user.profile?.profileCompleteness ?? 0;

  const hasActivity = listingsCount > 0 || proposalsSentCount > 0 || activeDealsCount > 0;

  return (
    <AppSection
      title="Dashboard Overview"
      description="Your complete activity summary. Real data only, no fabricated analytics."
    >
      {!hasActivity && profileCompleteness < 50 ? (
        <Card className="mb-8 border-[color:var(--px-primary)]/20 bg-[color:var(--px-primary)]/5">
          <div className="flex flex-col items-center justify-center p-6 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[color:var(--px-primary)] text-white">
              <CheckCircle2 size={32} />
            </div>
            <h2 className="text-xl font-bold text-[color:var(--px-text)]">Welcome to PerX</h2>
            <p className="mt-2 max-w-md text-[color:var(--px-text-muted)]">
              Your account is active. To get started, complete your profile to at least 80% and post your first opportunity or service.
            </p>
            <div className="mt-6 flex gap-4">
              <ButtonLink href="/app/profile/edit">Complete Profile</ButtonLink>
              <ButtonLink href="/app/opportunities/new" variant="secondary">Post an Opportunity</ButtonLink>
            </div>
          </div>
        </Card>
      ) : null}

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard title="Profile Completion" value={`${profileCompleteness}%`} icon={CheckCircle2} href="/app/profile" />
        <MetricCard title="Trust Score" value={trustScore > 0 ? trustScore : "New"} icon={ShieldCheck} href="/app/trust" />
        <MetricCard title="Active Agreements" value={activeDealsCount} icon={Handshake} href="/app/deals" />
        <MetricCard title="Completed Agreements" value={completedDealsCount} icon={Handshake} href="/app/deals" />
        
        <MetricCard title="Listings Created" value={listingsCount} icon={Briefcase} href="/app/opportunities" />
        <MetricCard title="Proposals Sent" value={proposalsSentCount} icon={ClipboardList} href="/app/proposals" />
        <MetricCard title="Proposals Received" value={proposalsReceivedCount} icon={ClipboardList} href="/app/proposals" />
        <MetricCard title="Saved Items" value={savedItemsCount} icon={Bookmark} href="/app/saved" />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card>
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-[color:var(--px-text)]">Recent Activity</h3>
          </div>
          <EmptyState title="No recent activity" body="Your latest interactions will appear here." />
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-[color:var(--px-text)]">Required Actions</h3>
          </div>
          {actualUnreadCount > 0 ? (
            <div className="mt-4 rounded-lg border border-[color:var(--px-border)] p-4">
              <div className="flex items-center gap-3">
                <MessageSquare className="text-[color:var(--px-primary)]" />
                <div>
                  <p className="font-medium text-[color:var(--px-text)]">You have {actualUnreadCount} unread message(s)</p>
                  <Link href="/app/messages" className="text-sm font-semibold text-[color:var(--px-primary)] hover:underline">
                    View messages
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            <EmptyState title="All caught up" body="You have no pending required actions." />
          )}
        </Card>
      </div>
    </AppSection>
  );
}

function MetricCard({ title, value, icon: Icon, href }: { title: string, value: string | number, icon: React.ElementType, href: string }) {
  return (
    <Link href={href} className="group rounded-[var(--px-radius-md)] border border-[color:var(--px-border)] bg-[color:var(--px-surface)] p-5 transition hover:border-[color:var(--px-primary)] hover:bg-[color:var(--px-surface-soft)]">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-semibold text-[color:var(--px-text-muted)] group-hover:text-[color:var(--px-text)]">{title}</p>
          <h4 className="mt-2 text-2xl font-black text-[color:var(--px-text)]">{value}</h4>
        </div>
        <div className="rounded-xl bg-[color:var(--px-muted)] p-2.5 text-[color:var(--px-text-muted)] group-hover:bg-[color:var(--px-primary-soft)] group-hover:text-[color:var(--px-primary)]">
          <Icon size={20} />
        </div>
      </div>
    </Link>
  );
}
