import Link from "next/link";

import { AppSection } from "@/components/app-section";
import { ButtonLink } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/card";
import { PendingSubmitButton } from "@/components/ui/pending-submit-button";
import { unblockUserAction } from "@/features/network/actions";
import { requireUser } from "@/lib/auth/session";
import { getPrisma } from "@/lib/db/prisma";

export default async function BlockedUsersPage() {
  const user = await requireUser();
  const blockedUsers = await getPrisma().blockedUser.findMany({
    include: {
      blockedUser: {
        select: {
          id: true,
          imageUrl: true,
          name: true,
          profile: { select: { headline: true, profileImageUrl: true } },
          username: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    where: { blockerUserId: user.id },
  });

  return (
    <AppSection
      actions={<ButtonLink href="/app/settings" variant="secondary">Back to settings</ButtonLink>}
      description="Blocked users cannot message you, send connection requests, or appear in your recommendations."
      title="Blocked users"
    >
      {blockedUsers.length ? (
        <div className="grid gap-3">
          {blockedUsers.map((block) => (
            <Card
              className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
              key={block.id}
            >
              <div className="flex min-w-0 items-center gap-3">
                <Avatar
                  imageUrl={
                    block.blockedUser.imageUrl ??
                    block.blockedUser.profile?.profileImageUrl ??
                    null
                  }
                  name={block.blockedUser.name}
                />
                <div className="min-w-0">
                  <Link
                    className="font-bold text-[color:var(--px-text)] hover:underline"
                    href={`/u/${block.blockedUser.username}`}
                  >
                    {block.blockedUser.name}
                  </Link>
                  <p className="truncate text-sm text-[color:var(--px-text-muted)]">
                    @{block.blockedUser.username}
                  </p>
                  <p className="truncate text-xs text-[color:var(--px-text-muted)]">
                    {block.blockedUser.profile?.headline ?? "PerX member"}
                  </p>
                </div>
              </div>
              <form action={async () => { "use server"; await unblockUserAction(block.blockedUser.id); }}>
                <PendingSubmitButton
                  className="w-full sm:w-auto"
                  pendingLabel="Unblocking..."
                  size="sm"
                  type="submit"
                  variant="secondary"
                >
                  Unblock
                </PendingSubmitButton>
              </form>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          body="You have not blocked anyone. Block controls appear on profiles and conversation details when available."
          title="No blocked users"
        />
      )}
    </AppSection>
  );
}

function Avatar({ imageUrl, name }: { imageUrl: string | null; name: string }) {
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full bg-[color:var(--px-primary)] font-black text-white">
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img alt={`${name} profile image`} className="h-full w-full object-cover" src={imageUrl} />
      ) : (
        initials
      )}
    </div>
  );
}
