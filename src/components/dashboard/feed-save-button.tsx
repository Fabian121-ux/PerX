"use client";

import { Bookmark } from "lucide-react";
import { useOptimistic, useTransition } from "react";

import { useToast } from "@/components/ui/feedback-provider";
import { setOpportunityBookmarkAction } from "@/features/opportunities/actions";

export function FeedSaveButton({
  initialSaved,
  opportunityId,
}: {
  initialSaved: boolean;
  opportunityId: string;
}) {
  const [pending, startTransition] = useTransition();
  const [saved, setOptimisticSaved] = useOptimistic(initialSaved);
  const toast = useToast();

  const toggle = () => {
    if (pending) return;
    const nextSaved = !saved;
    startTransition(async () => {
      setOptimisticSaved(nextSaved);
      let result: Awaited<ReturnType<typeof setOpportunityBookmarkAction>>;
      try {
        result = await setOpportunityBookmarkAction(opportunityId, nextSaved);
      } catch {
        result = { error: "Saving is temporarily unavailable." };
      }
      if (result.error) {
        setOptimisticSaved(saved);
        toast({
          description: result.error,
          title: "Could not update saved items",
          tone: "error",
        });
        return;
      }
      toast({
        title: nextSaved ? "Saved for later" : "Removed from saved items",
        tone: "success",
      });
    });
  };

  return (
    <button
      aria-label={saved ? "Remove from saved items" : "Save opportunity"}
      aria-pressed={saved}
      className={`inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)] ${
        saved
          ? "bg-[color:var(--px-primary-soft)] text-[color:var(--px-primary)]"
          : "text-[color:var(--px-text-muted)] hover:bg-[color:var(--px-muted)] hover:text-[color:var(--px-text)]"
      }`}
      disabled={pending}
      onClick={toggle}
      type="button"
    >
      <Bookmark aria-hidden fill={saved ? "currentColor" : "none"} size={18} />
      {saved ? "Saved" : "Save"}
    </button>
  );
}
