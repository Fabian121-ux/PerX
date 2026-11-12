"use client";

import { Loader2, ShieldAlert } from "lucide-react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormNotice } from "@/components/ui/form-notice";
import { PasswordInput } from "@/components/ui/password-input";
import {
  deleteAccountAction,
  type DeleteAccountState,
} from "@/features/account/deletion";

function DeleteSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button className="w-full sm:w-auto" disabled={pending} type="submit" variant="destructive">
      {pending ? (
        <>
          <Loader2 aria-hidden className="mr-2 animate-spin" size={16} />
          Deleting account…
        </>
      ) : (
        "Permanently delete account"
      )}
    </Button>
  );
}

export function DeleteAccountCard() {
  const [state, formAction] = useActionState(deleteAccountAction, {
    status: "idle",
  } satisfies DeleteAccountState);

  return (
    <Card className="border-red-500/30">
      <div className="flex items-start gap-3">
        <ShieldAlert aria-hidden className="mt-0.5 shrink-0 text-red-600" size={22} />
        <div className="min-w-0">
          <h2 className="font-semibold text-[color:var(--px-text)]">Delete account</h2>
          <p className="mt-2 text-sm leading-6 text-[color:var(--px-text-muted)]">
            This permanently removes your profile, personal settings, private notifications,
            connections, uploaded images, and personal message content. Your listings are
            archived. Shared conversations and deal records are retained with your identity
            anonymised where needed to protect other participants and transaction history.
            You can register again with the same email as a new account with a new ID.
          </p>
        </div>
      </div>

      {state.status === "error" && state.message ? (
        <FormNotice className="mt-4" tone="error">{state.message}</FormNotice>
      ) : null}

      <form action={formAction} className="mt-5 grid gap-4">
        <div className="grid gap-2 text-sm font-medium text-[color:var(--px-text)]">
          <label htmlFor="delete-account-password">Current password</label>
          <PasswordInput
            autoComplete="current-password"
            id="delete-account-password"
            name="password"
            required
          />
        </div>
        <div className="grid gap-2 text-sm font-medium text-[color:var(--px-text)]">
          <label htmlFor="delete-account-confirmation">Type DELETE to confirm</label>
          <input
            className="min-h-11 w-full rounded-[var(--px-radius-sm)] border border-[color:var(--px-border)] bg-[color:var(--px-surface)] px-3 text-base text-[color:var(--px-text)]"
            id="delete-account-confirmation"
            name="confirmation"
            autoComplete="off"
            required
          />
        </div>
        <DeleteSubmitButton />
      </form>
    </Card>
  );
}
