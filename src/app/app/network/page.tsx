import { AppSection } from "@/components/app-section";
import { getCurrentUser } from "@/lib/auth/session";
import { getPrisma } from "@/lib/db/prisma";
import Link from "next/link";
import { Card, EmptyState } from "@/components/ui/card";
import { PendingSubmitButton } from "@/components/ui/pending-submit-button";
import {
  acceptConnectionAction,
  disconnectAction,
  rejectConnectionAction,
  requestConnectionAction,
  startConversationAction,
} from "@/features/network/actions";

const networkUserSelect = {
  id: true,
  imageUrl: true,
  name: true,
  profile: {
    select: {
      headline: true,
      profileImageUrl: true,
      profileCompleteness: true,
    },
  },
  username: true,
} as const;

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
      requester: { select: networkUserSelect },
      receiver: { select: networkUserSelect },
    },
  });

  const pendingRequests = await getPrisma().connection.findMany({
    where: {
      status: "PENDING",
      receiverId: user.id,
    },
    include: {
      requester: { select: networkUserSelect },
    },
  });

  const existingConnectionIds = await getPrisma().connection.findMany({
    where: {
      OR: [{ requesterId: user.id }, { receiverId: user.id }],
    },
  }).then(res => res.flatMap(c => [c.requesterId, c.receiverId]));
  const blockedIds = await getPrisma().blockedUser.findMany({
    select: { blockedUserId: true, blockerUserId: true },
    where: {
      OR: [{ blockerUserId: user.id }, { blockedUserId: user.id }],
    },
  }).then((rows) =>
    rows.flatMap((block) => [block.blockedUserId, block.blockerUserId]),
  );

  const suggestions = await getPrisma().user.findMany({
    where: {
      accountClassification: "PUBLIC_BETA_USER",
      id: { notIn: [...new Set([...existingConnectionIds, ...blockedIds, user.id])] },
      isActive: true,
      profile: {
        is: {
          isDiscoverable: true,
          profileCompleteness: { gte: 40 },
        },
      },
    },
    select: networkUserSelect,
    take: 10,
    orderBy: [{ profile: { profileCompleteness: "desc" } }, { createdAt: "desc" }],
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
                      <PendingSubmitButton type="submit" variant="secondary" size="sm" pendingLabel="Removing...">Remove</PendingSubmitButton>
                    </form>
                    <form action={async () => { "use server"; await startConversationAction(connectedUser.id); }}>
                      <PendingSubmitButton type="submit" size="sm" pendingLabel="Opening conversation...">Message</PendingSubmitButton>
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
                    <PendingSubmitButton type="submit" className="w-full" size="sm" pendingLabel="Accepting...">Accept</PendingSubmitButton>
                  </form>
                  <form action={async () => { "use server"; await rejectConnectionAction(req.id); }} className="flex-1">
                    <PendingSubmitButton type="submit" variant="secondary" className="w-full" size="sm" pendingLabel="Declining...">Decline</PendingSubmitButton>
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
                    <PendingSubmitButton type="submit" className="w-full" size="sm" pendingLabel="Sending request...">Connect</PendingSubmitButton>
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
