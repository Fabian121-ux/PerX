/* eslint-disable @typescript-eslint/no-explicit-any, @next/next/no-img-element */
import { notFound } from "next/navigation";

import {
  BadgeCheck,
  BriefcaseBusiness,
  CalendarDays,
  ExternalLink,
  Flag,
  Globe2,
  Mail,
  MapPin,
  ShieldBan,
  Star,
} from "lucide-react";

import { PublicPageShell } from "@/components/standard-page";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/card";
import { PendingSubmitButton } from "@/components/ui/pending-submit-button";
import {
  TrustLevelBadge,
  TrustPresentationCard,
} from "@/components/trust/trust-presentation-card";
import {
  acceptConnectionAction,
  blockUserAction,
  cancelConnectionRequestAction,
  disconnectAction,
  rejectConnectionAction,
  requestConnectionAction,
  startConversationAction,
  unblockUserAction,
} from "@/features/network/actions";
import { getCurrentUser } from "@/lib/auth/session";
import { getPublicProfileResult } from "@/lib/data/profiles";
import { getPrisma } from "@/lib/db/prisma";
import { createTrustPresentation } from "@/lib/trust/presentation";
import {
  formatProfileDateRange,
  normalizePublicProfile,
} from "@/lib/profiles/view-model";

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const { profile, unavailable } = await getPublicProfileResult(username);
  if (unavailable) {
    return (
      <PublicPageShell>
        <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
          <EmptyState
            action={
              <ButtonLink href="/discover?type=PEOPLE">Find people</ButtonLink>
            }
            body="Please try again shortly."
            title="This section is temporarily unavailable."
          />
        </main>
      </PublicPageShell>
    );
  }
  if (!profile) notFound();

  const normalized = normalizePublicProfile(profile);
  const trustPresentation = createTrustPresentation({
    averageRating: normalized.averageRating,
    completedAgreements: normalized.completedDeals,
    emailVerified: normalized.emailVerified,
    profileCompleteness: normalized.profileCompleteness,
    publicReviewCount: normalized.publicReviewCount,
    summary: normalized.trust,
    verificationStatus: normalized.isVerified ? "VERIFIED" : null,
    viewer: "public",
  });
  const viewer = await getCurrentUser();
  const relationship =
    viewer && viewer.id !== normalized.id
      ? await getProfileRelationship(viewer.id, normalized.id)
      : null;

  return (
    <PublicPageShell>
      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:px-8">
        <section className="min-w-0">
          <Card className="overflow-hidden p-0">
            <div className="perx-hero-card h-28" />
            <div className="px-5 pb-6 sm:px-6">
              <div className="-mt-12 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:gap-4">
                  {normalized.profileImageUrl ? (
                    <img
                      alt={`${normalized.name} profile photo`}
                      className="h-20 w-20 shrink-0 rounded-[18px] border-4 border-[color:var(--px-surface)] bg-[color:var(--px-muted)] object-cover shadow-[var(--px-shadow)] sm:h-24 sm:w-24 sm:rounded-[22px]"
                      src={normalized.profileImageUrl}
                    />
                  ) : (
                    <div className="grid h-20 w-20 shrink-0 place-items-center rounded-[18px] border-4 border-[color:var(--px-surface)] bg-[color:var(--px-primary)] text-xl font-black text-white shadow-[var(--px-shadow)] sm:h-24 sm:w-24 sm:rounded-[22px] sm:text-2xl">
                      {getInitials(normalized.name)}
                    </div>
                  )}
                  <div className="min-w-0 pb-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h1 className="min-w-0 break-words text-2xl font-black text-[color:var(--px-text)] sm:text-3xl">
                        {normalized.name}
                      </h1>
                      {normalized.isVerified ? (
                        <Badge className="border-green-200 bg-green-50 text-green-800">
                          <BadgeCheck aria-hidden className="mr-1" size={13} />
                          Verified
                        </Badge>
                      ) : null}
                    </div>
                    <p className="mt-1 break-words text-base font-semibold text-[color:var(--px-text-muted)] sm:text-lg">
                      {normalized.headline}
                    </p>
                  </div>
                </div>
                <ProfilePrimaryAction
                  allowConnectionRequests={normalized.allowConnectionRequests}
                  allowMessagesFromConnections={
                    normalized.allowMessagesFromConnections
                  }
                  relationship={relationship}
                  targetUserId={normalized.id}
                  username={username}
                  viewerSignedIn={Boolean(viewer)}
                />
              </div>

              <div className="mt-5 flex flex-wrap gap-2 text-sm font-semibold text-[color:var(--px-text-muted)]">
                {normalized.location ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--px-surface-soft)] px-3 py-1.5">
                    <MapPin aria-hidden size={14} />
                    {normalized.location}
                  </span>
                ) : null}
                <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--px-surface-soft)] px-3 py-1.5">
                  <BriefcaseBusiness aria-hidden size={14} />
                  {normalized.completedDeals} completed deals
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--px-surface-soft)] px-3 py-1.5">
                  <Star aria-hidden size={14} />
                  {normalized.averageRating
                    ? `${normalized.averageRating.toFixed(1)} rating`
                    : "Reviews building"}
                </span>
                <TrustLevelBadge presentation={trustPresentation} />
              </div>

              <nav className="dashboard-scroll -mx-5 mt-6 flex gap-2 overflow-x-auto px-5 pb-1 sm:-mx-6 sm:px-6">
                {["About", "Portfolio", "Skills", "Experience", "Reviews"].map(
                  (item) => (
                    <a
                      className="shrink-0 rounded-full border border-[color:var(--px-border)] bg-[color:var(--px-surface)] px-4 py-2 text-sm font-bold text-[color:var(--px-text-muted)] hover:border-[color:var(--px-primary)] hover:text-[color:var(--px-primary)]"
                      href={`#${item.toLowerCase()}`}
                      key={item}
                    >
                      {item}
                    </a>
                  ),
                )}
              </nav>
            </div>
          </Card>

          <div className="mt-6 grid gap-5">
            <Card>
              <h2
                className="text-xl font-black text-[color:var(--px-text)]"
                id="about"
              >
                About
              </h2>
              <p className="mt-3 text-sm leading-7 text-[color:var(--px-text-muted)]">
                {normalized.biography}
              </p>
              <div className="mt-4 flex flex-wrap gap-3 text-sm font-semibold text-[color:var(--px-text-muted)]">
                {normalized.websiteUrl ? (
                  <a
                    className="inline-flex min-h-11 items-center gap-2 rounded-[var(--px-radius-sm)] border border-[color:var(--px-border)] px-3 text-[color:var(--px-primary)] hover:bg-[color:var(--px-surface-soft)]"
                    href={normalized.websiteUrl}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <Globe2 aria-hidden size={16} />
                    Website
                    <ExternalLink aria-hidden size={14} />
                  </a>
                ) : null}
                {normalized.createdAt ? (
                  <span className="inline-flex min-h-11 items-center gap-2 rounded-[var(--px-radius-sm)] bg-[color:var(--px-surface-soft)] px-3">
                    <CalendarDays aria-hidden size={16} />
                    Joined {formatProfileJoinDate(normalized.createdAt)}
                  </span>
                ) : null}
              </div>
            </Card>

            <Card>
              <h2 className="text-xl font-black text-[color:var(--px-text)]">
                Published work
              </h2>
              <div className="mt-4 grid gap-3">
                {normalized.opportunities.length ? (
                  normalized.opportunities.map((opportunity: any) => (
                    <ButtonLink
                      className="justify-start"
                      href={`/opportunities/${opportunity.slug}`}
                      key={opportunity.id}
                      variant="secondary"
                    >
                      <BriefcaseBusiness
                        aria-hidden
                        className="mr-2"
                        size={16}
                      />
                      {opportunity.title}
                    </ButtonLink>
                  ))
                ) : (
                  <p className="text-sm text-[color:var(--px-text-muted)]">
                    Published opportunities and listings will appear here.
                  </p>
                )}
              </div>
            </Card>

            <Card>
              <h2
                className="text-xl font-black text-[color:var(--px-text)]"
                id="portfolio"
              >
                Portfolio
              </h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {normalized.portfolio.length ? (
                  normalized.portfolio.map((item: any) => (
                    <article
                      className="rounded-[var(--px-radius-sm)] border border-[color:var(--px-border)] bg-[color:var(--px-surface-soft)] p-4"
                      key={item.id}
                    >
                      <h3 className="font-bold text-[color:var(--px-text)]">
                        {item.title}
                      </h3>
                      <p className="mt-2 text-sm leading-6 text-[color:var(--px-text-muted)]">
                        {item.description}
                      </p>
                      {item.url ? (
                        <a
                          className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-[color:var(--px-primary)]"
                          href={item.url}
                          rel="noreferrer"
                          target="_blank"
                        >
                          View project
                          <ExternalLink aria-hidden size={14} />
                        </a>
                      ) : null}
                    </article>
                  ))
                ) : (
                  <p className="text-sm text-[color:var(--px-text-muted)] sm:col-span-2">
                    Portfolio projects will appear after this member adds them.
                  </p>
                )}
              </div>
            </Card>

            <Card>
              <h2
                className="text-xl font-black text-[color:var(--px-text)]"
                id="skills"
              >
                Skills
              </h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {normalized.skills.length ? (
                  normalized.skills.map((skill) => (
                    <Badge key={skill}>{skill}</Badge>
                  ))
                ) : (
                  <p className="text-sm text-[color:var(--px-text-muted)]">
                    Skills will appear after this profile is completed.
                  </p>
                )}
              </div>
            </Card>

            <Card>
              <h2
                className="text-xl font-black text-[color:var(--px-text)]"
                id="experience"
              >
                Experience
              </h2>
              <div className="mt-4 grid gap-3">
                {normalized.workHistory.length ? (
                  normalized.workHistory.map((item: any) => (
                    <div
                      className="rounded-[var(--px-radius-sm)] bg-[color:var(--px-surface-soft)] p-4"
                      key={item.id ?? `${item.title}-${item.company}`}
                    >
                      <h3 className="font-bold text-[color:var(--px-text)]">
                        {item.title}
                      </h3>
                      <p className="mt-1 text-sm font-semibold text-[color:var(--px-text-muted)]">
                        {item.company}
                      </p>
                      {formatProfileDateRange(item.startedAt, item.endedAt) ? (
                        <p className="mt-1 text-xs font-semibold text-[color:var(--px-text-muted)]">
                          {formatProfileDateRange(item.startedAt, item.endedAt)}
                        </p>
                      ) : null}
                      {item.summary ? (
                        <p className="mt-2 text-sm leading-6 text-[color:var(--px-text-muted)]">
                          {item.summary}
                        </p>
                      ) : null}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-[color:var(--px-text-muted)]">
                    Experience details will appear after this member adds work
                    history or completes eligible deals.
                  </p>
                )}
              </div>
            </Card>

            <Card>
              <h2
                className="text-xl font-black text-[color:var(--px-text)]"
                id="reviews"
              >
                Reviews
              </h2>
              <div className="mt-4 grid gap-3">
                {normalized.reviews.length ? (
                  normalized.reviews.map((review: any) => (
                    <div
                      className="rounded-[var(--px-radius-sm)] border border-[color:var(--px-border)] p-4"
                      key={review.id}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="font-bold text-[color:var(--px-text)]">
                          {review.title}
                        </h3>
                        <Badge className="bg-green-50 text-green-800">
                          {review.rating}/5
                        </Badge>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-[color:var(--px-text-muted)]">
                        {review.body}
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-[color:var(--px-text-muted)]">
                        <span>{review.author?.name ?? "PerX participant"}</span>
                        {review.createdAt ? (
                          <>
                            <span aria-hidden>·</span>
                            <time
                              dateTime={new Date(
                                review.createdAt,
                              ).toISOString()}
                            >
                              {new Date(review.createdAt).toLocaleDateString(
                                "en",
                                {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                },
                              )}
                            </time>
                          </>
                        ) : null}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-[color:var(--px-text-muted)]">
                    Public reviews will appear after completed eligible
                    agreements.
                  </p>
                )}
                <span data-profile-end="true" />
              </div>
            </Card>
          </div>
        </section>

        <aside className="grid gap-5 self-start lg:sticky lg:top-24">
          <Card>
            <h2 className="font-black text-[color:var(--px-text)]">
              Availability
            </h2>
            <div className="mt-4 grid gap-3">
              <div className="flex items-center gap-3 rounded-[var(--px-radius-sm)] bg-[color:var(--px-surface-soft)] p-3">
                <CalendarDays
                  className="text-[color:var(--px-primary)]"
                  size={18}
                />
                <div>
                  <p className="text-sm font-bold text-[color:var(--px-text)]">
                    {normalized.allowConnectionRequests
                      ? "Connection requests open"
                      : "Connection requests closed"}
                  </p>
                  <p className="text-xs text-[color:var(--px-text-muted)]">
                    {normalized.allowConnectionRequests
                      ? "Use the profile action to send a request."
                      : "This member is not accepting new requests."}
                  </p>
                </div>
              </div>
              {!viewer && normalized.allowConnectionRequests ? (
                <ButtonLink
                  className="w-full"
                  href={`/sign-in?next=/u/${username}`}
                >
                  Connect With
                </ButtonLink>
              ) : null}
            </div>
          </Card>

          {viewer && viewer.id !== normalized.id ? (
            <Card>
              <h2 className="font-black text-[color:var(--px-text)]">Safety</h2>
              <p className="mt-2 text-sm leading-6 text-[color:var(--px-text-muted)]">
                Report this profile if it appears abusive, misleading, or
                unsafe.
              </p>
              <ButtonLink
                className="mt-4 w-full"
                href={`/app/reports/new?targetType=USER&targetId=${encodeURIComponent(
                  normalized.id,
                )}`}
                variant="secondary"
              >
                Report profile
              </ButtonLink>
            </Card>
          ) : null}

          <TrustPresentationCard
            presentation={trustPresentation}
            variant="compact"
          />
          <Card>
            <h2 className="font-black text-[color:var(--px-text)]">Roles</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {normalized.roles.map((role) => (
                <Badge key={role}>{role}</Badge>
              ))}
            </div>
          </Card>
        </aside>
      </main>
    </PublicPageShell>
  );
}

function formatProfileJoinDate(value: Date | string) {
  return new Date(value).toLocaleDateString("en", {
    month: "long",
    year: "numeric",
  });
}

async function getProfileRelationship(viewerId: string, targetUserId: string) {
  const [connection, block] = await Promise.all([
    getPrisma().connection.findFirst({
      where: {
        OR: [
          { requesterId: viewerId, receiverId: targetUserId },
          { requesterId: targetUserId, receiverId: viewerId },
        ],
      },
    }),
    getPrisma().blockedUser.findFirst({
      where: {
        OR: [
          { blockerUserId: viewerId, blockedUserId: targetUserId },
          { blockerUserId: targetUserId, blockedUserId: viewerId },
        ],
      },
    }),
  ]);

  return {
    blocked: Boolean(block),
    connectionDirection: connection
      ? connection.requesterId === viewerId
        ? "outgoing"
        : "incoming"
      : null,
    connectionId: connection?.id ?? null,
    status: connection?.status ?? "NONE",
  };
}

function ProfilePrimaryAction({
  allowConnectionRequests,
  allowMessagesFromConnections,
  relationship,
  targetUserId,
  username,
  viewerSignedIn,
}: {
  allowConnectionRequests: boolean;
  allowMessagesFromConnections: boolean;
  relationship: Awaited<ReturnType<typeof getProfileRelationship>> | null;
  targetUserId: string;
  username: string;
  viewerSignedIn: boolean;
}) {
  if (!viewerSignedIn) {
    if (!allowConnectionRequests) {
      return (
        <Button className="w-full sm:w-auto" disabled variant="secondary">
          Requests closed
        </Button>
      );
    }
    return (
      <ButtonLink
        className="w-full sm:w-auto"
        href={`/sign-in?next=/u/${username}`}
      >
        <Mail aria-hidden className="mr-2" size={16} />
        Connect With
      </ButtonLink>
    );
  }

  if (!relationship) {
    return (
      <ButtonLink className="w-full sm:w-auto" href="/app/profile">
        View private profile
      </ButtonLink>
    );
  }

  if (relationship.blocked || relationship.status === "BLOCKED") {
    return (
      <div className="flex flex-wrap gap-2">
        <form
          action={async () => {
            "use server";
            await unblockUserAction(targetUserId);
          }}
        >
          <PendingSubmitButton
            className="w-full sm:w-auto"
            pendingLabel="Unblocking..."
            type="submit"
          >
            Unblock
          </PendingSubmitButton>
        </form>
        <ButtonLink
          href={`/app/reports/new?targetType=USER&targetId=${encodeURIComponent(targetUserId)}`}
          size="sm"
          variant="ghost"
        >
          <Flag aria-hidden className="mr-1.5" size={14} />
          Report
        </ButtonLink>
      </div>
    );
  }

  if (relationship.status === "ACCEPTED") {
    return (
      <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
        <Button className="w-full sm:w-auto" disabled variant="secondary">
          Connected
        </Button>
        {allowMessagesFromConnections ? (
          <form
            action={async () => {
              "use server";
              await startConversationAction(targetUserId);
            }}
          >
            <PendingSubmitButton
              className="w-full sm:w-auto"
              pendingLabel="Opening conversation..."
              type="submit"
            >
              <Mail aria-hidden className="mr-2" size={16} />
              Message
            </PendingSubmitButton>
          </form>
        ) : null}
        <form
          action={async () => {
            "use server";
            await disconnectAction(relationship.connectionId!);
          }}
        >
          <PendingSubmitButton
            className="w-full sm:w-auto"
            pendingLabel="Removing..."
            type="submit"
            variant="secondary"
          >
            Remove Connection
          </PendingSubmitButton>
        </form>
        <form
          action={async () => {
            "use server";
            await blockUserAction(targetUserId);
          }}
        >
          <PendingSubmitButton
            className="w-full sm:w-auto"
            pendingLabel="Blocking..."
            type="submit"
            variant="outline"
          >
            <ShieldBan aria-hidden className="mr-2" size={16} />
            Block
          </PendingSubmitButton>
        </form>
      </div>
    );
  }

  if (
    relationship.status === "PENDING" &&
    relationship.connectionDirection === "outgoing" &&
    relationship.connectionId
  ) {
    return (
      <div className="flex flex-wrap gap-2">
        <Button className="w-full sm:w-auto" disabled variant="secondary">
          Pending
        </Button>
        <form
          action={async () => {
            "use server";
            await cancelConnectionRequestAction(relationship.connectionId!);
          }}
        >
          <PendingSubmitButton
            className="w-full sm:w-auto"
            pendingLabel="Cancelling..."
            type="submit"
            variant="secondary"
          >
            Cancel Request
          </PendingSubmitButton>
        </form>
        <form
          action={async () => {
            "use server";
            await blockUserAction(targetUserId);
          }}
        >
          <PendingSubmitButton
            pendingLabel="Blocking..."
            type="submit"
            variant="outline"
          >
            Block
          </PendingSubmitButton>
        </form>
      </div>
    );
  }

  if (
    relationship.status === "PENDING" &&
    relationship.connectionDirection === "incoming" &&
    relationship.connectionId
  ) {
    return (
      <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
        <form
          action={async () => {
            "use server";
            await acceptConnectionAction(relationship.connectionId!);
          }}
        >
          <PendingSubmitButton
            className="w-full sm:w-auto"
            pendingLabel="Accepting..."
            type="submit"
          >
            Accept Connection
          </PendingSubmitButton>
        </form>
        <form
          action={async () => {
            "use server";
            await rejectConnectionAction(relationship.connectionId!);
          }}
        >
          <PendingSubmitButton
            className="w-full sm:w-auto"
            pendingLabel="Declining..."
            type="submit"
            variant="secondary"
          >
            Decline
          </PendingSubmitButton>
        </form>
        <form
          action={async () => {
            "use server";
            await blockUserAction(targetUserId);
          }}
        >
          <PendingSubmitButton
            pendingLabel="Blocking..."
            type="submit"
            variant="outline"
          >
            Block
          </PendingSubmitButton>
        </form>
      </div>
    );
  }

  if (allowConnectionRequests) {
    return (
      <div className="flex flex-wrap gap-2">
        <form
          action={async () => {
            "use server";
            await requestConnectionAction(targetUserId);
          }}
        >
          <PendingSubmitButton
            className="w-full sm:w-auto"
            pendingLabel="Sending request..."
            type="submit"
          >
            Connect
          </PendingSubmitButton>
        </form>
        <form
          action={async () => {
            "use server";
            await blockUserAction(targetUserId);
          }}
        >
          <PendingSubmitButton
            pendingLabel="Blocking..."
            type="submit"
            variant="outline"
          >
            Block
          </PendingSubmitButton>
        </form>
      </div>
    );
  }

  return (
    <Button className="w-full sm:w-auto" disabled variant="secondary">
      Connect With
    </Button>
  );
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
