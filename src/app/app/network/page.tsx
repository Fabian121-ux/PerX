import { AppSection } from "@/components/app-section";
import { getCurrentUser } from "@/lib/auth/session";
import { getPrisma } from "@/lib/db/prisma";
import Link from "next/link";
import { Card, EmptyState } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  acceptConnectionAction,
  disconnectAction,
  rejectConnectionAction,
  requestConnectionAction,
  startConversationAction,
} from "@/features/network/actions";

export default async function NetworkPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await getCurrentUser();
  if (!user) return null;

  const resolvedSearchParams = await searchParams;
  const currentTab = resolvedSearchParams.tab || "connections";

  const connections = await getPrisma().connection.findMany({
    where: {
      status: "ACCEPTED",
      OR: [{ requesterId: user.id }, { receiverId: user.id }],
    },
    include: {
      requester: { include: { profile: true } },
      receiver: { include: { profile: true } },
    },
  });

  const pendingRequests = await getPrisma().connection.findMany({
    where: {
      status: "PENDING",
      receiverId: user.id,
    },
    include: {
      requester: { include: { profile: true } },
    },
  });

  // Get users to suggest (not connected, not pending, high trust score)
  const existingConnectionIds = await getPrisma().connection.findMany({
    where: {
      OR: [{ requesterId: user.id }, { receiverId: user.id }],
    },
  }).then(res => res.flatMap(c => [c.requesterId, c.receiverId]));

  const suggestions = await getPrisma().user.findMany({
    where: {
      id: { notIn: [...existingConnectionIds, user.id] },
      isActive: true,
      profile: { trustScore: { gt: 50 } }
    },
    include: { profile: true },
    take: 10,
    orderBy: { profile: { trustScore: "desc" } }
  });

  return (
    <AppSection
      title="Network"
      description="Manage your professional relationships and connections."
    >
      <div className="mb-6 flex gap-4 border-b border-[color:var(--px-border)]">
        <Link
          href="?tab=connections"
          className={`border-b-2 pb-2 text-sm font-semibold transition-colors ${currentTab === "connections" ? "border-[color:var(--px-primary)] text-[color:var(--px-primary)]" : "border-transparent text-[color:var(--px-text-muted)] hover:text-[color:var(--px-text)]"}`}
        >
          Connections ({connections.length})
        </Link>
        <Link
          href="?tab=requests"
          className={`border-b-2 pb-2 text-sm font-semibold transition-colors ${currentTab === "requests" ? "border-[color:var(--px-primary)] text-[color:var(--px-primary)]" : "border-transparent text-[color:var(--px-text-muted)] hover:text-[color:var(--px-text)]"}`}
        >
          Pending Requests ({pendingRequests.length})
        </Link>
        <Link
          href="?tab=suggestions"
          className={`border-b-2 pb-2 text-sm font-semibold transition-colors ${currentTab === "suggestions" ? "border-[color:var(--px-primary)] text-[color:var(--px-primary)]" : "border-transparent text-[color:var(--px-text-muted)] hover:text-[color:var(--px-text)]"}`}
        >
          Suggestions
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {currentTab === "connections" && (
          connections.length > 0 ? (
            connections.map(conn => {
              const connectedUser = conn.requesterId === user.id ? conn.receiver : conn.requester;
              return (
                <Card key={conn.id} className="flex flex-col gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[color:var(--px-primary-soft)] font-bold text-[color:var(--px-primary)]">
                      {connectedUser.name[0]}
                    </div>
                    <div>
                      <h3 className="font-semibold text-[color:var(--px-text)]">{connectedUser.name}</h3>
                      <p className="text-xs text-[color:var(--px-text-muted)]">{connectedUser.profile?.headline || "PerX Member"}</p>
                    </div>
                  </div>
                  <div className="mt-auto flex justify-end gap-2">
                    <form action={async () => { "use server"; await disconnectAction(conn.id); }}>
                      <Button type="submit" variant="secondary" size="sm">Remove</Button>
                    </form>
                    <form action={async () => { "use server"; await startConversationAction(connectedUser.id); }}>
                      <Button type="submit" size="sm">Message</Button>
                    </form>
                  </div>
                </Card>
              )
            })
          ) : (
            <div className="col-span-full">
              <EmptyState title="No connections yet" body="Expand your network to collaborate and build trust." action={<Link href="?tab=suggestions" className="text-sm font-bold text-[color:var(--px-primary)] hover:underline">Find people</Link>} />
            </div>
          )
        )}

        {currentTab === "requests" && (
          pendingRequests.length > 0 ? (
            pendingRequests.map(req => (
              <Card key={req.id} className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[color:var(--px-primary-soft)] font-bold text-[color:var(--px-primary)]">
                    {req.requester.name[0]}
                  </div>
                  <div>
                    <h3 className="font-semibold text-[color:var(--px-text)]">{req.requester.name}</h3>
                    <p className="text-xs text-[color:var(--px-text-muted)]">{req.requester.profile?.headline || "PerX Member"}</p>
                  </div>
                </div>
                <div className="mt-auto flex gap-2">
                  <form action={async () => { "use server"; await acceptConnectionAction(req.id); }} className="flex-1">
                    <Button type="submit" className="w-full" size="sm">Accept</Button>
                  </form>
                  <form action={async () => { "use server"; await rejectConnectionAction(req.id); }} className="flex-1">
                    <Button type="submit" variant="secondary" className="w-full" size="sm">Decline</Button>
                  </form>
                </div>
              </Card>
            ))
          ) : (
            <div className="col-span-full">
              <EmptyState title="No pending requests" body="You don't have any incoming connection requests." />
            </div>
          )
        )}

        {currentTab === "suggestions" && (
          suggestions.length > 0 ? (
            suggestions.map(sug => (
              <Card key={sug.id} className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[color:var(--px-primary-soft)] font-bold text-[color:var(--px-primary)]">
                    {sug.name[0]}
                  </div>
                  <div>
                    <h3 className="font-semibold text-[color:var(--px-text)]">{sug.name}</h3>
                    <p className="text-xs text-[color:var(--px-text-muted)]">{sug.profile?.headline || "PerX Member"}</p>
                  </div>
                </div>
                <div className="mt-auto">
                  <form action={async () => { "use server"; await requestConnectionAction(sug.id); }}>
                    <Button type="submit" className="w-full" size="sm">Connect</Button>
                  </form>
                </div>
              </Card>
            ))
          ) : (
            <div className="col-span-full">
              <EmptyState title="No suggestions right now" body="Check back later for new people to connect with." />
            </div>
          )
        )}
      </div>
    </AppSection>
  );
}
