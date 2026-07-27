/* eslint-disable @typescript-eslint/no-explicit-any, @next/next/no-img-element */
import { notFound } from "next/navigation";

import {
  BadgeCheck,
  BriefcaseBusiness,
  CalendarDays,
  Mail,
  MapPin,
  ShieldCheck,
  Star,
} from "lucide-react";

import { PublicPageShell } from "@/components/standard-page";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/card";
import {
  acceptConnectionAction,
  requestConnectionAction,
  startConversationAction,
} from "@/features/network/actions";
import { getCurrentUser } from "@/lib/auth/session";
import { getPublicProfileResult } from "@/lib/data/profiles";
import { getPrisma } from "@/lib/db/prisma";
import { calculateTrustSummary, trustBadgeClassName } from "@/lib/trust/engine";

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
            action={<ButtonLink href="/discover?type=PEOPLE">Find people</ButtonLink>}
            body="Please try again shortly."
            title="This section is temporarily unavailable."
          />
        </main>
      </PublicPageShell>
    );
  }
  if (!profile) notFound();

  const normalized = normalizeProfile(profile);
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
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 ${trustBadgeClassName(
                    normalized.trust.level,
                  )}`}
                >
                  <ShieldCheck aria-hidden size={14} />
                  {normalized.trust.label}
                </span>
              </div>

              <nav className="dashboard-scroll -mx-5 mt-6 flex gap-2 overflow-x-auto px-5 pb-1 sm:-mx-6 sm:px-6">
                {["About", "Skills", "Experience", "Reviews"].map((item) => (
                  <a
                    className="shrink-0 rounded-full border border-[color:var(--px-border)] bg-[color:var(--px-surface)] px-4 py-2 text-sm font-bold text-[color:var(--px-text-muted)] hover:border-[color:var(--px-primary)] hover:text-[color:var(--px-primary)]"
                    href={`#${item.toLowerCase()}`}
                    key={item}
                  >
                    {item}
                  </a>
                ))}
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
                      <BriefcaseBusiness aria-hidden className="mr-2" size={16} />
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
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-[color:var(--px-text-muted)]">
                    Public reviews will appear after completed eligible
                    agreements.
                  </p>
                )}
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
                    Open to enquiries
                  </p>
                  <p className="text-xs text-[color:var(--px-text-muted)]">
                    Availability is confirmed in conversation.
                  </p>
                </div>
              </div>
              <ButtonLink
                className="w-full"
                href={`/sign-in?next=/u/${username}`}
              >
                Contact member
              </ButtonLink>
            </div>
          </Card>

          {viewer && viewer.id !== normalized.id ? (
            <Card>
              <h2 className="font-black text-[color:var(--px-text)]">
                Safety
              </h2>
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

          <Card>
            <h2 className="font-black text-[color:var(--px-text)]">Trust</h2>
            <div
              className={`mt-4 rounded-[18px] border p-5 text-center ${trustBadgeClassName(
                normalized.trust.level,
              )}`}
            >
              <ShieldCheck className="mx-auto" size={24} />
              <p className="mt-2 text-sm font-bold">
                {normalized.trust.label}
              </p>
              <p className="mt-2 text-xs leading-5">
                {normalized.trust.description}
              </p>
            </div>
            <div className="mt-4 grid gap-2">
              {normalized.trust.evidence.length ? (
                normalized.trust.evidence.slice(0, 4).map((item) => (
                  <span
                    className="rounded-[var(--px-radius-sm)] bg-[color:var(--px-surface-soft)] px-3 py-2 text-xs font-semibold text-[color:var(--px-text-muted)]"
                    key={item}
                  >
                    {item}
                  </span>
                ))
              ) : (
                <p className="text-sm text-[color:var(--px-text-muted)]">
                  Trust information is still building.
                </p>
              )}
            </div>
            <div className="mt-4 grid gap-2">
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

function normalizeProfile(profile: any) {
  const details =
    profile.profile && typeof profile.profile === "object"
      ? profile.profile
      : {};

  const roles: string[] = Array.isArray(profile.roles)
    ? profile.roles
        .map((entry: any) =>
          typeof entry === "string"
            ? entry
            : (entry.role?.label ?? entry.role?.name ?? null),
        )
        .filter(Boolean)
    : [];

  const skillsSource = Array.isArray(details.skills)
    ? details.skills
    : Array.isArray(profile.skills)
      ? profile.skills
      : [];

  const skills: string[] = skillsSource
    .map((entry: any) => (typeof entry === "string" ? entry : entry.name))
    .filter(Boolean);

  const averageRating = Number(
    details.averageRating ?? profile.averageRating ?? 0,
  );

  return {
    allowConnectionRequests: details.allowConnectionRequests ?? true,
    allowMessagesFromConnections:
      details.allowMessagesFromConnections ?? true,
    allowMessagesFromMembers: details.allowMessagesFromMembers ?? false,
    averageRating: Number.isFinite(averageRating) ? averageRating : 0,
    biography:
      details.biography ??
      profile.biography ??
      "This member has not completed a biography.",
    completedDeals: Number(
      details.completedDeals ?? profile.completedDeals ?? 0,
    ),
    headline: details.headline ?? profile.headline ?? "perX member",
    id: profile.id,
    isVerified: profile.verificationStatus === "VERIFIED",
    location:
      details.showLocation === false
        ? null
        : (details.location ?? profile.location ?? null),
    name: profile.name ?? "perX member",
    opportunities: Array.isArray(profile.opportunities)
      ? profile.opportunities
      : [],
    profileImageUrl:
      details.profileImageUrl ??
      profile.profileImageUrl ??
      profile.imageUrl ??
      "",
    reviews: Array.isArray(profile.reviewsReceived)
      ? profile.reviewsReceived
      : [],
    roles,
    skills: details.showSkills === false ? [] : skills,
    trust: calculateTrustSummary({
      averageRating,
      completedDeals: Number(
        details.completedDeals ?? profile.completedDeals ?? 0,
      ),
      emailVerifiedAt: profile.emailVerifiedAt ?? null,
      profileCompleteness: Number(
        details.profileCompleteness ?? profile.profileCompleteness ?? 0,
      ),
      verificationStatus: profile.verificationStatus,
    }),
    workHistory: Array.isArray(details.workHistory) ? details.workHistory : [],
  };
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
    return (
      <ButtonLink className="w-full sm:w-auto" href={`/sign-in?next=/u/${username}`}>
        <Mail aria-hidden className="mr-2" size={16} />
        Contact
      </ButtonLink>
    );
  }

  if (!relationship) {
    return <ButtonLink className="w-full sm:w-auto" href="/app/profile">View private profile</ButtonLink>;
  }

  if (relationship.blocked || relationship.status === "BLOCKED") {
    return <Button className="w-full sm:w-auto" disabled>Unavailable</Button>;
  }

  if (relationship.status === "ACCEPTED" && allowMessagesFromConnections) {
    return (
      <form action={async () => { "use server"; await startConversationAction(targetUserId); }}>
        <Button className="w-full sm:w-auto" type="submit">
          <Mail aria-hidden className="mr-2" size={16} />
          Message
        </Button>
      </form>
    );
  }

  if (relationship.status === "PENDING" && relationship.connectionDirection === "outgoing") {
    return <Button className="w-full sm:w-auto" disabled variant="secondary">Request sent</Button>;
  }

  if (
    relationship.status === "PENDING" &&
    relationship.connectionDirection === "incoming" &&
    relationship.connectionId
  ) {
    return (
      <form action={async () => { "use server"; await acceptConnectionAction(relationship.connectionId!); }}>
        <Button className="w-full sm:w-auto" type="submit">Accept connection</Button>
      </form>
    );
  }

  if (allowConnectionRequests) {
    return (
      <form action={async () => { "use server"; await requestConnectionAction(targetUserId); }}>
        <Button className="w-full sm:w-auto" type="submit">Connect</Button>
      </form>
    );
  }

  return <Button className="w-full sm:w-auto" disabled variant="secondary">Connections closed</Button>;
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
