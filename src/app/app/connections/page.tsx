import {
  Flag,
  Inbox,
  MessageCircle,
  Search,
  Send,
  ShieldBan,
  UserRoundPlus,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AppSection } from "@/components/app-section";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/card";
import { Input } from "@/components/ui/form";
import { PendingSubmitButton } from "@/components/ui/pending-submit-button";
import {
  acceptConnectionAction,
  blockUserAction,
  cancelConnectionRequestAction,
  disconnectAction,
  rejectConnectionAction,
  requestConnectionAction,
  startConversationAction,
} from "@/features/network/actions";
import {
  CONNECTION_COPY,
  CONNECTION_DISCOVER_LIMIT,
  getConnectedLabel,
  getConnectionsTabData,
  normalizeConnectionsQuery,
  type NetworkEntry,
} from "@/features/network/data";
import {
  buildConnectionsPath,
  normalizeConnectionsTab,
  type ConnectionSearchParam,
  type ConnectionTab,
} from "@/features/network/routes";
import { requireUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

const tabs: {
  icon: typeof Search;
  key: ConnectionTab;
  label: string;
}[] = [
  { icon: Search, key: "discover", label: "Discover People" },
  { icon: Inbox, key: "requests", label: "Connection Requests" },
  { icon: Send, key: "sent", label: "Sent Requests" },
  { icon: UsersRound, key: "connections", label: "My Connections" },
];

const emptyStates: Record<ConnectionTab, { body: string; title: string }> = {
  connections: {
    body: "Accepted connections with eligible, visible PerX members will appear here.",
    title: "No connections yet",
  },
  discover: {
    body: "Try another search or check back as more eligible members make their profiles visible.",
    title: "No discoverable people found",
  },
  requests: {
    body: "Eligible incoming connection requests will appear here.",
    title: "No connection requests",
  },
  sent: {
    body: "Connection requests you send will appear here while they are pending.",
    title: "No sent requests",
  },
};

export default async function ConnectionsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: ConnectionSearchParam;
    tab?: ConnectionSearchParam;
  }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const tab = normalizeConnectionsTab(params.tab);
  const rawTab = Array.isArray(params.tab) ? params.tab[0] : params.tab;
  const normalizedRawTab = rawTab?.trim().toLowerCase();

  if (normalizedRawTab && normalizedRawTab !== tab) {
    redirect(buildConnectionsPath(tab, params.q));
  }

  const q = normalizeConnectionsQuery(params.q);
  const entries = await getConnectionsTabData(user.id, tab, { q });

  return (
    <AppSection
      description="Discover eligible PerX members and manage connection requests in one place."
      title="Connections"
    >
      <nav
        aria-label="Connection sections"
        className="flex gap-2 overflow-x-auto border-b border-[color:var(--px-border)] pb-2"
      >
        {tabs.map((item) => {
          const Icon = item.icon;
          const active = item.key === tab;
          return (
            <Link
              aria-current={active ? "page" : undefined}
              className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-t-[var(--px-radius-sm)] border-b-2 px-3 text-sm font-bold transition-colors ${
                active
                  ? "border-[color:var(--px-primary)] text-[color:var(--px-primary)]"
                  : "border-transparent text-[color:var(--px-text-muted)] hover:text-[color:var(--px-text)]"
              }`}
              href={buildConnectionsPath(item.key, item.key === "discover" ? q : undefined)}
              key={item.key}
            >
              <Icon aria-hidden size={17} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {tab === "discover" ? (
        <Card>
          <form
            action="/app/connections"
            className="flex flex-col gap-3 sm:flex-row"
            role="search"
          >
            <input name="tab" type="hidden" value="discover" />
            <label className="relative min-w-0 flex-1">
              <span className="sr-only">Search discoverable people</span>
              <Search
                aria-hidden
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--px-text-muted)]"
                size={17}
              />
              <Input
                className="pl-10"
                defaultValue={q}
                maxLength={80}
                name="q"
                placeholder="Search by name, username, or headline"
              />
            </label>
            <Button type="submit" variant="secondary">
              Search
            </Button>
            {q ? (
              <ButtonLink href={buildConnectionsPath("discover")} variant="ghost">
                Clear
              </ButtonLink>
            ) : null}
          </form>
          <p className="mt-3 text-xs text-[color:var(--px-text-muted)]">
            Showing up to {CONNECTION_DISCOVER_LIMIT} eligible results. Refine your search to find a specific person.
          </p>
        </Card>
      ) : null}

      {entries.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {entries.map((entry) => (
            <ConnectionCard entry={entry} key={`${entry.relationship}-${entry.id}`} />
          ))}
        </div>
      ) : (
        <EmptyState {...emptyStates[tab]} />
      )}
    </AppSection>
  );
}

function ConnectionCard({ entry }: { entry: NetworkEntry }) {
  return (
    <Card className="flex min-h-full flex-col gap-4">
      <div className="flex items-start gap-3">
        <Avatar entry={entry} />
        <div className="min-w-0 flex-1">
          <Link
            className="block truncate font-bold text-[color:var(--px-text)] hover:underline"
            href={`/u/${entry.username}`}
          >
            {entry.name}
          </Link>
          <p className="truncate text-sm font-semibold text-[color:var(--px-text-muted)]">
            @{entry.username}
          </p>
          <p className="mt-1 line-clamp-2 text-sm leading-6 text-[color:var(--px-text-muted)]">
            {entry.headline}
          </p>
        </div>
      </div>

      <div className="mt-auto flex flex-wrap items-center gap-2">
        <RelationshipActions entry={entry} />
        <form
          action={async () => {
            "use server";
            await blockUserAction(entry.id);
          }}
        >
          <PendingSubmitButton
            pendingLabel="Blocking..."
            size="sm"
            type="submit"
            variant="outline"
          >
            <ShieldBan aria-hidden className="mr-1.5" size={14} />
            {CONNECTION_COPY.block}
          </PendingSubmitButton>
        </form>
        <ButtonLink
          href={`/app/reports/new?targetType=USER&targetId=${encodeURIComponent(entry.id)}`}
          size="sm"
          variant="ghost"
        >
          <Flag aria-hidden className="mr-1.5" size={14} />
          {CONNECTION_COPY.report}
        </ButtonLink>
      </div>
    </Card>
  );
}

function RelationshipActions({ entry }: { entry: NetworkEntry }) {
  if (entry.relationship === "CONNECTED" && entry.connectionId) {
    return (
      <>
        <span className="inline-flex min-h-9 items-center rounded-[var(--px-radius-sm)] bg-green-50 px-3 text-xs font-black text-green-800">
          {getConnectedLabel(entry.isPartner)}
        </span>
        {entry.canMessage ? (
          <form
            action={async () => {
              "use server";
              await startConversationAction(entry.id);
            }}
          >
            <PendingSubmitButton
              pendingLabel="Opening conversation..."
              size="sm"
              type="submit"
            >
              <MessageCircle aria-hidden className="mr-1.5" size={14} />
              {CONNECTION_COPY.message}
            </PendingSubmitButton>
          </form>
        ) : null}
        <form
          action={async () => {
            "use server";
            await disconnectAction(entry.connectionId!);
          }}
        >
          <PendingSubmitButton
            pendingLabel="Removing..."
            size="sm"
            type="submit"
            variant="secondary"
          >
            {CONNECTION_COPY.remove}
          </PendingSubmitButton>
        </form>
      </>
    );
  }

  if (entry.relationship === "PENDING_INCOMING" && entry.connectionId) {
    return (
      <>
        <form
          action={async () => {
            "use server";
            await acceptConnectionAction(entry.connectionId!);
          }}
        >
          <PendingSubmitButton
            pendingLabel="Accepting..."
            size="sm"
            type="submit"
          >
            {CONNECTION_COPY.accept}
          </PendingSubmitButton>
        </form>
        <form
          action={async () => {
            "use server";
            await rejectConnectionAction(entry.connectionId!);
          }}
        >
          <PendingSubmitButton
            pendingLabel="Declining..."
            size="sm"
            type="submit"
            variant="secondary"
          >
            {CONNECTION_COPY.decline}
          </PendingSubmitButton>
        </form>
      </>
    );
  }

  if (entry.relationship === "PENDING_OUTGOING" && entry.connectionId) {
    return (
      <>
        <span className="inline-flex min-h-9 items-center rounded-[var(--px-radius-sm)] bg-[color:var(--px-primary-soft)] px-3 text-xs font-black text-[color:var(--px-primary)]">
          {CONNECTION_COPY.requestSent}
        </span>
        <form
          action={async () => {
            "use server";
            await cancelConnectionRequestAction(entry.connectionId!);
          }}
        >
          <PendingSubmitButton
            pendingLabel="Removing..."
            size="sm"
            type="submit"
            variant="secondary"
          >
            {CONNECTION_COPY.remove}
          </PendingSubmitButton>
        </form>
      </>
    );
  }

  if (!entry.canRequest) return null;

  return (
    <form
      action={async () => {
        "use server";
        await requestConnectionAction(entry.id);
      }}
    >
      <PendingSubmitButton
        pendingLabel="Sending request..."
        size="sm"
        type="submit"
      >
        <UserRoundPlus aria-hidden className="mr-1.5" size={14} />
        {CONNECTION_COPY.connect}
      </PendingSubmitButton>
    </form>
  );
}

function Avatar({ entry }: { entry: NetworkEntry }) {
  const initials = entry.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl bg-[color:var(--px-primary)] font-black text-white">
      {entry.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt={`${entry.name} profile image`}
          className="h-full w-full object-cover"
          src={entry.imageUrl}
        />
      ) : (
        initials
      )}
    </div>
  );
}
