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
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getPublicProfile } from "@/lib/data/profiles";

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const profile = await getPublicProfile(username);
  if (!profile) notFound();

  const normalized = normalizeProfile(profile);

  return (
    <PublicPageShell>
      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:px-8">
        <section className="min-w-0">
          <Card className="overflow-hidden p-0">
            <div className="perx-hero-card h-28" />
            <div className="px-5 pb-6 sm:px-6">
              <div className="-mt-12 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="flex items-end gap-4">
                  {normalized.profileImageUrl ? (
                    <img
                      alt={`${normalized.name} profile photo`}
                      className="h-24 w-24 shrink-0 rounded-[22px] border-4 border-[color:var(--px-surface)] bg-[color:var(--px-muted)] object-cover shadow-[var(--px-shadow)]"
                      src={normalized.profileImageUrl}
                    />
                  ) : (
                    <div className="grid h-24 w-24 shrink-0 place-items-center rounded-[22px] border-4 border-[color:var(--px-surface)] bg-[color:var(--px-primary)] text-2xl font-black text-white shadow-[var(--px-shadow)]">
                      {getInitials(normalized.name)}
                    </div>
                  )}
                  <div className="pb-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h1 className="text-3xl font-black text-[color:var(--px-text)]">
                        {normalized.name}
                      </h1>
                      <Badge className="border-green-200 bg-green-50 text-green-800">
                        <BadgeCheck aria-hidden className="mr-1" size={13} />
                        Verified
                      </Badge>
                    </div>
                    <p className="mt-1 text-lg font-semibold text-[color:var(--px-text-muted)]">
                      {normalized.headline}
                    </p>
                  </div>
                </div>
                <ButtonLink href={`/sign-in?next=/u/${username}`}>
                  <Mail aria-hidden className="mr-2" size={16} />
                  Contact
                </ButtonLink>
              </div>

              <div className="mt-5 flex flex-wrap gap-2 text-sm font-semibold text-[color:var(--px-text-muted)]">
                <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--px-surface-soft)] px-3 py-1.5">
                  <MapPin aria-hidden size={14} />
                  {normalized.location}
                </span>
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

          <Card>
            <h2 className="font-black text-[color:var(--px-text)]">Trust</h2>
            <div className="mt-4 rounded-[18px] border border-green-200 bg-green-50 p-5 text-center">
              <ShieldCheck className="mx-auto text-green-700" size={24} />
              <p className="mt-2 text-sm font-bold text-green-800">
                Trust score
              </p>
              <p className="mt-1 text-4xl font-black text-green-950">
                {normalized.trustScore}
              </p>
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
    averageRating: Number.isFinite(averageRating) ? averageRating : 0,
    biography:
      details.biography ??
      profile.biography ??
      "This member has not completed a biography.",
    completedDeals: Number(
      details.completedDeals ?? profile.completedDeals ?? 0,
    ),
    headline: details.headline ?? profile.headline ?? "perX member",
    location: details.location ?? profile.location ?? "Remote",
    name: profile.name ?? "perX member",
    profileImageUrl:
      details.profileImageUrl ??
      profile.profileImageUrl ??
      profile.imageUrl ??
      "",
    reviews: Array.isArray(profile.reviewsReceived)
      ? profile.reviewsReceived
      : [],
    roles,
    skills,
    trustScore: Number(details.trustScore ?? profile.trustScore ?? 0),
    workHistory: Array.isArray(details.workHistory) ? details.workHistory : [],
  };
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
