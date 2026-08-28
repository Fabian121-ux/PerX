"use client";

import { Loader2 } from "lucide-react";
import { useState, useTransition } from "react";

import { decideTraderApplicationAction } from "@/features/trader/actions";
import { Button } from "@/components/ui/button";
import { FormNotice } from "@/components/ui/form-notice";
import { Textarea } from "@/components/ui/form";
import { useConfirm, useToast } from "@/components/ui/feedback-provider";

type Decision = "APPROVED" | "NEEDS_CHANGES" | "REJECTED";

const LABELS: Record<Decision, string> = {
  APPROVED: "Approve",
  NEEDS_CHANGES: "Request changes",
  REJECTED: "Reject",
};

/**
 * Reviewer decision controls.
 *
 * Approve is the routine outcome and submits directly. Reject is confirmed,
 * because it withdraws access and is the one action a reviewer is most likely
 * to regret firing by accident - the destructive control should not look and
 * behave identically to the routine one.
 *
 * Per-decision pending state so the reviewer can see which button they pressed,
 * and a recoverable error with Retry rather than a toast that disappears.
 */
export function TraderDecisionControls({
  applicationId,
}: {
  applicationId: string;
}) {
  const confirm = useConfirm();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [active, setActive] = useState<Decision | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const decide = (decision: Decision) => {
    setError(null);
    setActive(decision);
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("applicationId", applicationId);
        formData.set("decision", decision);
        if (note.trim()) formData.set("reviewerNote", note.trim());
        await decideTraderApplicationAction(formData);
        toast({
          description:
            decision === "APPROVED"
              ? "Trading access is now active for this account."
              : "The applicant has been notified of the decision.",
          title: LABELS[decision],
          tone: "success",
        });
      } catch {
        setError("That decision could not be recorded. Nothing was changed.");
      } finally {
        setActive(null);
      }
    });
  };

  const run = async (decision: Decision) => {
    if (decision === "REJECTED") {
      const approved = await confirm({
        confirmLabel: "Reject application",
        description:
          "This withdraws trading access. Existing listings and deals are kept.",
        title: "Reject this application?",
        tone: "danger",
      });
      if (!approved) return;
    }
    decide(decision);
  };

  return (
    <div className="grid gap-3 border-t border-white/10 pt-3">
      <label className="grid gap-1 text-xs font-semibold text-slate-300">
        Note to applicant (optional)
        <Textarea
          maxLength={600}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Explain what is needed, if anything."
          rows={2}
          value={note}
        />
      </label>

      {error ? (
        <FormNotice tone="error">
          <span className="flex flex-wrap items-center gap-3">
            {error}
            <button
              className="underline underline-offset-2"
              onClick={() => active && decide(active)}
              type="button"
            >
              Retry
            </button>
          </span>
        </FormNotice>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {(["APPROVED", "NEEDS_CHANGES", "REJECTED"] as const).map(
          (decision) => (
            <Button
              aria-busy={pending && active === decision}
              disabled={pending}
              key={decision}
              onClick={() => void run(decision)}
              size="sm"
              type="button"
              variant={
                decision === "APPROVED"
                  ? "primary"
                  : decision === "REJECTED"
                    ? "outline"
                    : "secondary"
              }
            >
              {pending && active === decision ? (
                <>
                  <Loader2
                    aria-hidden
                    className="mr-2 animate-spin"
                    size={14}
                  />
                  Working
                </>
              ) : (
                LABELS[decision]
              )}
            </Button>
          ),
        )}
      </div>
    </div>
  );
}
