"use client";

import { Loader2 } from "lucide-react";
import { useState, useTransition } from "react";

import { revokeUserSessionsAction } from "@/features/admin/actions";
import { Button } from "@/components/ui/button";
import { FormNotice } from "@/components/ui/form-notice";
import { useConfirm, useToast } from "@/components/ui/feedback-provider";

type Status =
  | { kind: "idle" }
  | { kind: "error"; message: string }
  | { kind: "done"; revoked: number };

/**
 * Force sign-out control.
 *
 * Confirmed rather than immediate: revocation is not destructive - the user can
 * sign back in - but it interrupts whatever they are doing on every device, so
 * it should not fire from a single stray click. It is not a typed-confirmation
 * ceremony either; reserving that for genuinely irreversible actions keeps the
 * signal meaningful.
 *
 * Failures stay on screen with a Retry rather than dismissing, because an admin
 * responding to a compromised account needs to know whether the sessions
 * actually went away.
 */
export function AdminUserSessionControls({ userId }: { userId: string }) {
  const confirm = useConfirm();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const revoke = async () => {
    const approved = await confirm({
      confirmLabel: "Revoke sessions",
      description:
        "This signs the account out on every device. They can sign in again with their existing password.",
      title: "Revoke all sessions?",
      tone: "danger",
    });
    if (!approved) return;

    setStatus({ kind: "idle" });
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("userId", userId);
        const result = await revokeUserSessionsAction(formData);
        setStatus({ kind: "done", revoked: result?.revoked ?? 0 });
        toast({
          description:
            result?.revoked === 1
              ? "1 session was revoked."
              : `${result?.revoked ?? 0} sessions were revoked.`,
          title: "Sessions revoked",
          tone: "success",
        });
      } catch {
        // Deliberately generic: the server message may carry detail that does
        // not belong in the browser.
        setStatus({
          kind: "error",
          message: "The sessions could not be revoked. Nothing was changed.",
        });
      }
    });
  };

  return (
    <div className="grid gap-2">
      <div>
        <Button
          aria-busy={pending}
          disabled={pending}
          onClick={revoke}
          size="sm"
          type="button"
          variant="outline"
        >
          {pending ? (
            <>
              <Loader2 aria-hidden className="mr-2 animate-spin" size={15} />
              Revoking sessions
            </>
          ) : (
            "Revoke all sessions"
          )}
        </Button>
      </div>

      {status.kind === "error" ? (
        <FormNotice tone="error">
          <span className="flex flex-wrap items-center gap-3">
            {status.message}
            <button
              className="underline underline-offset-2"
              onClick={revoke}
              type="button"
            >
              Retry
            </button>
          </span>
        </FormNotice>
      ) : null}

      {status.kind === "done" ? (
        <FormNotice tone="success">
          {status.revoked === 1
            ? "1 session revoked."
            : `${status.revoked} sessions revoked.`}
        </FormNotice>
      ) : null}

      <p className="text-xs text-slate-400">
        Signs the account out everywhere. The account stays active and the
        password is unchanged.
      </p>
    </div>
  );
}
