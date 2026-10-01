"use client";
import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { socialPostPath, type SocialFormState } from "@/lib/social/contracts";
export function SocialForm({
  action,
  fields = {},
  label,
  inputLabel,
  initialBody = "",
  maxLength,
  navigateToPost = false,
  deletedPost = false,
}: {
  action: (state: SocialFormState, data: FormData) => Promise<SocialFormState>;
  fields?: Record<string, string>;
  label: string;
  inputLabel?: string;
  initialBody?: string;
  maxLength?: number;
  navigateToPost?: boolean;
  deletedPost?: boolean;
}) {
  const [text, setText] = useState(initialBody);
  const [state, submit, pending] = useActionState(async (previous: SocialFormState, data: FormData) => {
    const result = await action(previous, data);
    if (result.status === "success" && !initialBody) setText("");
    return result;
  }, { status: "idle" });
  const router = useRouter();
  useEffect(() => {
    if (state.status !== "success") return;
    if (navigateToPost && state.id) router.push(socialPostPath(state.id));
    else if (deletedPost) router.push("/posts");
    router.refresh();
  }, [state, router, navigateToPost, deletedPost, initialBody]);
  return (
    <form action={submit} className="grid min-w-0 gap-3">
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} name={name} type="hidden" value={value} />
      ))}
      {inputLabel && (
        <label className="grid min-w-0 gap-2 text-sm font-semibold">
          {inputLabel}
          <textarea
            className="min-h-28 w-full min-w-0 rounded-xl border border-[color:var(--px-border)] bg-[color:var(--px-surface)] p-3 text-[color:var(--px-text)]"
            name="body"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={maxLength}
            required
            disabled={pending}
          />
        </label>
      )}
      <Button className="w-fit" disabled={pending} type="submit">
        {pending ? "Saving…" : label}
      </Button>
      {state.message && (
        <p
          className="text-sm"
          role={state.status === "error" ? "alert" : "status"}
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
