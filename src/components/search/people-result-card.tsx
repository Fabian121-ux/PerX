import { BadgeCheck, MapPin, MessageCircle, UserRoundPlus } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PendingSubmitButton } from "@/components/ui/pending-submit-button";
import {
  acceptConnectionAction,
  rejectConnectionAction,
  requestConnectionAction,
  startConversationAction,
} from "@/features/network/actions";
import type { PeopleDirectoryEntry } from "@/lib/data/people";
import { trustBadgeClassName } from "@/lib/trust/engine";

export function PeopleResultCard({ person }: { person: PeopleDirectoryEntry }) {
  return (
    <Card className="flex min-h-full flex-col gap-4">
      <div className="flex items-start gap-3">
        <PersonAvatar person={person} />
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
        <Badge className={trustBadgeClassName(person.trust.level)}>
          {person.trust.shortLabel}
        </Badge>
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

      <div className="mt-auto flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <ButtonLink
          className="w-full sm:w-auto"
          href={`/u/${person.username}`}
          size="sm"
          variant="secondary"
        >
          View profile
        </ButtonLink>
        <ConnectionAction person={person} />
        {person.canStartConversation ? (
          <form
            action={async () => {
              "use server";
              await startConversationAction(person.id);
            }}
          >
            <PendingSubmitButton
              className="w-full sm:w-auto"
              pendingLabel="Opening conversation..."
              size="sm"
              type="submit"
            >
              <MessageCircle aria-hidden className="mr-2" size={15} />
              Message
            </PendingSubmitButton>
          </form>
        ) : null}
      </div>
    </Card>
  );
}

function ConnectionAction({ person }: { person: PeopleDirectoryEntry }) {
  if (person.connectionState === "ACCEPTED") {
    return (
      <Button
        className="w-full sm:w-auto"
        disabled
        size="sm"
        variant="secondary"
      >
        Connected
      </Button>
    );
  }

  if (
    person.connectionState === "PENDING" &&
    person.connectionDirection === "outgoing"
  ) {
    return (
      <Button
        className="w-full sm:w-auto"
        disabled
        size="sm"
        variant="secondary"
      >
        Request sent
      </Button>
    );
  }

  if (
    person.connectionState === "PENDING" &&
    person.connectionDirection === "incoming" &&
    person.connectionId
  ) {
    const connectionId = person.connectionId;
    return (
      <div className="flex w-full gap-2 sm:w-auto">
        <form
          action={async () => {
            "use server";
            await acceptConnectionAction(connectionId);
          }}
        >
          <PendingSubmitButton
            pendingLabel="Accepting..."
            size="sm"
            type="submit"
          >
            Accept
          </PendingSubmitButton>
        </form>
        <form
          action={async () => {
            "use server";
            await rejectConnectionAction(connectionId);
          }}
        >
          <PendingSubmitButton
            pendingLabel="Declining..."
            size="sm"
            type="submit"
            variant="secondary"
          >
            Decline
          </PendingSubmitButton>
        </form>
      </div>
    );
  }

  if (person.connectionState === "BLOCKED") {
    return (
      <Button
        className="w-full sm:w-auto"
        disabled
        size="sm"
        variant="secondary"
      >
        Blocked
      </Button>
    );
  }

  if (!person.canRequestConnection) return null;

  return (
    <form
      action={async () => {
        "use server";
        await requestConnectionAction(person.id);
      }}
    >
      <PendingSubmitButton
        className="w-full sm:w-auto"
        pendingLabel="Sending request..."
        size="sm"
        type="submit"
        variant="secondary"
      >
        <UserRoundPlus aria-hidden className="mr-2" size={15} />
        Connect
      </PendingSubmitButton>
    </form>
  );
}

function PersonAvatar({ person }: { person: PeopleDirectoryEntry }) {
  const initials = person.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="relative h-14 w-14 shrink-0">
      <div className="grid h-14 w-14 place-items-center overflow-hidden rounded-2xl bg-[color:var(--px-primary)] font-black text-white">
        {person.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt={`${person.name} profile image`}
            className="h-full w-full object-cover"
            src={person.imageUrl}
          />
        ) : (
          initials
        )}
      </div>
      {person.presence === "online" || person.presence === "recent" ? (
        <span
          aria-label={
            person.presence === "online" ? "Online" : "Recently active"
          }
          className={`absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full ring-2 ring-[color:var(--px-surface)] ${
            person.presence === "online" ? "bg-green-500" : "bg-amber-400"
          }`}
          title={person.presence === "online" ? "Online" : "Recently active"}
        />
      ) : null}
    </div>
  );
}
