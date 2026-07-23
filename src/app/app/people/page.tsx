import { BadgeCheck, MapPin, MessageCircle, Search, UserRoundPlus } from "lucide-react";
import Link from "next/link";

import { AppSection } from "@/components/app-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/form";
import {
  acceptConnectionAction,
  requestConnectionAction,
  startConversationAction,
} from "@/features/network/actions";
import { requireUser } from "@/lib/auth/session";
import { getPeopleDirectory, type PeopleDirectoryEntry } from "@/lib/data/people";
import { roleLabels } from "@/lib/permissions/capabilities";

export const dynamic = "force-dynamic";

export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<{
    cursor?: string;
    location?: string;
    q?: string;
    role?: string;
    skill?: string;
  }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const { nextCursor, people } = await getPeopleDirectory(user.id, params);
  const query = new URLSearchParams();
  for (const key of ["q", "skill", "location", "role"] as const) {
    if (params[key]) query.set(key, params[key]!);
  }

  return (
    <AppSection
      actions={<ButtonLink href="/app/connections">My connections</ButtonLink>}
      description="Find active PerX members who have chosen to be discoverable."
      title="People"
    >
      <div className="grid gap-5">
        <Card>
          <form className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_180px_180px_auto]" role="search">
            <label className="relative">
              <span className="sr-only">Search by name or username</span>
              <Search
                aria-hidden
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--px-text-muted)]"
                size={17}
              />
              <Input
                className="pl-10"
                defaultValue={params.q}
                name="q"
                placeholder="Search people"
              />
            </label>
            <label>
              <span className="sr-only">Skill filter</span>
              <Input defaultValue={params.skill} name="skill" placeholder="Skill" />
            </label>
            <label>
              <span className="sr-only">Location filter</span>
              <Input defaultValue={params.location} name="location" placeholder="Location" />
            </label>
            <label>
              <span className="sr-only">Role filter</span>
              <Select defaultValue={params.role ?? ""} name="role">
                <option value="">Any role</option>
                {Object.entries(roleLabels)
                  .filter(([value]) => !["ADMIN", "INTERNAL_TESTER"].includes(value))
                  .map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
              </Select>
            </label>
            <Button type="submit" variant="secondary">
              Search
            </Button>
          </form>
        </Card>

        {people.length ? (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {people.map((person) => (
                <PeopleCard key={person.id} person={person} />
              ))}
            </div>
            {nextCursor ? (
              <div className="flex justify-center">
                <ButtonLink
                  href={`/app/people?${new URLSearchParams({
                    ...Object.fromEntries(query),
                    cursor: nextCursor,
                  }).toString()}`}
                  variant="secondary"
                >
                  Load more people
                </ButtonLink>
              </div>
            ) : null}
          </>
        ) : (
          <EmptyState
            body="Try a broader search or check back after more members complete public profiles."
            title="No discoverable people found"
          />
        )}
      </div>
    </AppSection>
  );
}

function PeopleCard({ person }: { person: PeopleDirectoryEntry }) {
  return (
    <Card className="flex min-h-full flex-col gap-4">
      <div className="flex items-start gap-3">
        <Avatar imageUrl={person.imageUrl} name={person.name} />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <Link
              className="truncate font-bold text-[color:var(--px-text)] hover:underline"
              href={`/u/${person.username}`}
            >
              {person.name}
            </Link>
            {person.isVerified ? (
              <BadgeCheck
                aria-label="Verified profile"
                className="shrink-0 text-[color:var(--px-primary)]"
                size={17}
              />
            ) : null}
          </div>
          <p className="truncate text-sm font-semibold text-[color:var(--px-text-muted)]">
            @{person.username}
          </p>
          <p className="mt-1 line-clamp-2 text-sm leading-6 text-[color:var(--px-text-muted)]">
            {person.headline}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {person.location ? (
          <Badge className="bg-[color:var(--px-surface-soft)] text-[color:var(--px-text-muted)]">
            <MapPin aria-hidden className="mr-1" size={13} />
            {person.location}
          </Badge>
        ) : null}
        {person.roles.slice(0, 2).map((role) => (
          <Badge key={role}>{role}</Badge>
        ))}
        {person.trustScore > 0 ? <Badge>Trust {person.trustScore}</Badge> : null}
      </div>

      {person.skills.length ? (
        <div className="flex flex-wrap gap-1.5">
          {person.skills.slice(0, 5).map((skill) => (
            <span
              className="rounded-full bg-[color:var(--px-muted)] px-2.5 py-1 text-xs font-semibold text-[color:var(--px-text-muted)]"
              key={skill}
            >
              {skill}
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-auto flex flex-wrap gap-2">
        <ButtonLink href={`/u/${person.username}`} size="sm" variant="secondary">
          View profile
        </ButtonLink>
        <ConnectionAction person={person} />
        {person.canStartConversation ? (
          <form action={async () => { "use server"; await startConversationAction(person.id); }}>
            <Button size="sm" type="submit">
              <MessageCircle aria-hidden className="mr-2" size={15} />
              Message
            </Button>
          </form>
        ) : null}
      </div>
    </Card>
  );
}

function ConnectionAction({ person }: { person: PeopleDirectoryEntry }) {
  if (person.connectionState === "ACCEPTED") {
    return <Button disabled size="sm" variant="secondary">Connected</Button>;
  }
  if (person.connectionState === "PENDING" && person.connectionDirection === "outgoing") {
    return <Button disabled size="sm" variant="secondary">Request sent</Button>;
  }
  if (person.connectionState === "PENDING" && person.connectionDirection === "incoming" && person.connectionId) {
    return (
      <form action={async () => { "use server"; await acceptConnectionAction(person.connectionId!); }}>
        <Button size="sm" type="submit">Accept</Button>
      </form>
    );
  }
  if (person.connectionState === "BLOCKED") {
    return <Button disabled size="sm" variant="secondary">Blocked</Button>;
  }
  if (!person.canRequestConnection) return null;

  return (
    <form action={async () => { "use server"; await requestConnectionAction(person.id); }}>
      <Button size="sm" type="submit" variant="secondary">
        <UserRoundPlus aria-hidden className="mr-2" size={15} />
        Connect
      </Button>
    </form>
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
    <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl bg-[color:var(--px-primary)] font-black text-white">
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt={`${name} profile image`}
          className="h-full w-full object-cover"
          src={imageUrl}
        />
      ) : (
        initials
      )}
    </div>
  );
}
