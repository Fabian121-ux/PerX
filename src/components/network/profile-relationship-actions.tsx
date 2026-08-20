"use client";

import { Flag, Loader2, Mail, ShieldBan } from "lucide-react";
import { useOptimistic, useTransition } from "react";

import { Button, ButtonLink } from "@/components/ui/button";
import { useToast } from "@/components/ui/feedback-provider";

/**
 * Authoritative relationship state rendered by the server.
 *
 * Optimistic transitions are layered on top of this value; React discards the
 * optimistic override once the surrounding transition settles and the server
 * re-renders, so the server always reconciles the final state.
 */
export type ProfileRelationshipState =
  | "UNKNOWN"
  | "INCOMING"
  | "OUTGOING"
  | "CONNECTED"
  | "BLOCKED";

export type ProfileRelationshipActionResult = { error?: string };

export type ProfileRelationshipActions = {
  accept: () => Promise<ProfileRelationshipActionResult>;
  block: () => Promise<ProfileRelationshipActionResult>;
  cancel: () => Promise<ProfileRelationshipActionResult>;
  connect: () => Promise<ProfileRelationshipActionResult>;
  decline: () => Promise<ProfileRelationshipActionResult>;
  disconnect: () => Promise<ProfileRelationshipActionResult>;
  message: () => Promise<ProfileRelationshipActionResult>;
  unblock: () => Promise<ProfileRelationshipActionResult>;
};

type MutationKey =
  | "accept"
  | "block"
  | "cancel"
  | "connect"
  | "decline"
  | "disconnect"
  | "message"
  | "unblock";

const PENDING_LABELS: Record<MutationKey, string> = {
  accept: "Accepting...",
  block: "Blocking...",
  cancel: "Cancelling...",
  connect: "Sending request...",
  decline: "Declining...",
  disconnect: "Removing...",
  message: "Opening conversation...",
  unblock: "Unblocking...",
};

const FAILURE_TITLES: Record<MutationKey, string> = {
  accept: "Could not accept request",
  block: "Could not block",
  cancel: "Could not cancel request",
  connect: "Could not send request",
  decline: "Could not decline request",
  disconnect: "Could not remove connection",
  message: "Could not open conversation",
  unblock: "Could not unblock",
};

function RelationshipActionButton({
  children,
  disabled,
  mutation,
  onClick,
  pending,
  variant,
}: {
  children: React.ReactNode;
  disabled: boolean;
  mutation: MutationKey;
  onClick: () => void;
  pending: boolean;
  variant?: "outline" | "secondary";
}) {
  return (
    <Button
      className="w-full sm:w-auto"
      disabled={disabled}
      onClick={onClick}
      type="button"
      variant={variant}
    >
      {pending ? (
        <>
          <Loader2 aria-hidden className="mr-2 animate-spin" size={15} />
          {PENDING_LABELS[mutation]}
        </>
      ) : (
        children
      )}
    </Button>
  );
}

export function ProfileRelationshipActions({
  actions,
  allowMessages,
  initialState,
  targetUserId,
}: {
  actions: ProfileRelationshipActions;
  allowMessages: boolean;
  initialState: ProfileRelationshipState;
  targetUserId: string;
}) {
  const [isPending, startTransition] = useTransition();
  // `state` is authoritative between transitions; the optimistic value is
  // applied immediately on click and automatically discarded when the
  // server-rendered `initialState` arrives.
  const [state, applyOptimisticState] = useOptimistic(initialState);
  const [pendingKey, applyPendingKey] = useOptimistic<MutationKey | null>(null);
  const toast = useToast();

  const run = (
    key: MutationKey,
    optimisticState: ProfileRelationshipState,
    successMessage?: string,
  ) => {
    // Prevent duplicate submissions while any mutation is in flight.
    if (isPending) return;
    const previousState = state;

    startTransition(async () => {
      // Immediate feedback: relationship state flips before the round-trip.
      applyOptimisticState(optimisticState);
      applyPendingKey(key);

      let result: ProfileRelationshipActionResult;
      try {
        result = await actions[key]();
      } catch {
        result = { error: "Something went wrong. Please try again." };
      }

      if (result?.error) {
        // Roll back to the previous authoritative state.
        applyOptimisticState(previousState);
        applyPendingKey(null);
        toast({
          description: result.error,
          title: FAILURE_TITLES[key],
          tone: "error",
        });
        return;
      }

      if (successMessage) toast({ title: successMessage, tone: "success" });
    });
  };

  const actionProps = (mutation: MutationKey) => ({
    disabled: isPending,
    mutation,
    pending: isPending && pendingKey === mutation,
  });

  const reportAction = (
    <ButtonLink
      className="w-full sm:w-auto"
      href={`/app/reports/new?targetType=USER&targetId=${encodeURIComponent(
        targetUserId,
      )}`}
      variant="ghost"
    >
      <Flag aria-hidden className="mr-2" size={16} />
      Report
    </ButtonLink>
  );

  const blockAction = (
    <RelationshipActionButton {...actionProps("block")}
      onClick={() => run("block", "BLOCKED", "User blocked")}
      variant="outline"
    >
      <ShieldBan aria-hidden className="mr-2" size={16} />
      Block
    </RelationshipActionButton>
  );

  const container =
    "flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap";

  // BLOCKED must never expose Connect, Send Request, or Message.
  if (state === "BLOCKED") {
    return (
      <div className={container} data-relationship-state="BLOCKED">
        <RelationshipActionButton {...actionProps("unblock")}
          onClick={() => run("unblock", "UNKNOWN", "User unblocked")}
        >
          Unblock
        </RelationshipActionButton>
        {reportAction}
      </div>
    );
  }

  if (state === "CONNECTED") {
    return (
      <div className={container} data-relationship-state="CONNECTED">
        {allowMessages ? (
          <RelationshipActionButton {...actionProps("message")} onClick={() => run("message", state)}>
            <Mail aria-hidden className="mr-2" size={16} />
            Message
          </RelationshipActionButton>
        ) : (
          <Button className="w-full sm:w-auto" disabled variant="secondary">
            Connected
          </Button>
        )}
        <RelationshipActionButton {...actionProps("disconnect")}
          onClick={() => run("disconnect", "UNKNOWN", "Connection removed")}
          variant="secondary"
        >
          Remove Connection
        </RelationshipActionButton>
        {blockAction}
        {reportAction}
      </div>
    );
  }

  if (state === "OUTGOING") {
    return (
      <div className={container} data-relationship-state="OUTGOING">
        <Button className="w-full sm:w-auto" disabled variant="secondary">
          Pending
        </Button>
        <RelationshipActionButton {...actionProps("cancel")}
          onClick={() => run("cancel", "UNKNOWN", "Request cancelled")}
          variant="secondary"
        >
          Cancel Request
        </RelationshipActionButton>
        {blockAction}
        {reportAction}
      </div>
    );
  }

  if (state === "INCOMING") {
    return (
      <div className={container} data-relationship-state="INCOMING">
        <RelationshipActionButton {...actionProps("accept")}
          onClick={() => run("accept", "CONNECTED", "Connection accepted")}
        >
          Accept Connection
        </RelationshipActionButton>
        <RelationshipActionButton {...actionProps("decline")}
          onClick={() => run("decline", "UNKNOWN", "Request declined")}
          variant="secondary"
        >
          Decline
        </RelationshipActionButton>
        {blockAction}
        {reportAction}
      </div>
    );
  }

  return (
    <div className={container} data-relationship-state="UNKNOWN">
      <RelationshipActionButton {...actionProps("connect")}
        onClick={() => run("connect", "OUTGOING", "Connection request sent")}
      >
        Connect
      </RelationshipActionButton>
      {blockAction}
      {reportAction}
    </div>
  );
}
