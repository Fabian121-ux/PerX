"use client";
import { useActionState } from "react";
import { moderateSocialAction } from "@/features/social/actions";
import { Button } from "@/components/ui/button";
export function SocialModerationForm({
  targetId,
  targetType,
}: {
  targetId: string;
  targetType: "post" | "comment";
}) {
  const [state, submit, pending] = useActionState(moderateSocialAction, {
    status: "idle",
  });
  return (
    <form action={submit} className="grid gap-2">
      <input name="targetId" type="hidden" value={targetId} />
      <input name="targetType" type="hidden" value={targetType} />
      <label className="grid gap-1">
        Moderation reason
        <input
          className="min-w-0 rounded border p-2"
          name="reason"
          minLength={8}
          maxLength={1000}
          required
        />
      </label>
      <Button type="submit" disabled={pending}>
        Hide {targetType}
      </Button>
      {state.message && (
        <p role={state.status === "error" ? "alert" : "status"}>
          {state.message}
        </p>
      )}
    </form>
  );
}
