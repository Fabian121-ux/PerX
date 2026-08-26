"use client";

import { LogOut } from "lucide-react";
import { useState, type ReactNode } from "react";

import { signOutAction } from "@/features/auth/actions";
import { clearAuthenticatedClientState } from "@/lib/auth/client-session-cleanup";

/**
 * The single sign-out control used by every surface.
 *
 * Why this is a button with an explicit handler rather than a bare
 * `<form action={signOutAction}>`: the account menu renders its items through
 * Radix `DropdownMenu.Item asChild`, which calls `preventDefault()` on the
 * item's click as part of closing the menu. That cancelled the native form
 * submission, so the server action never ran and the session stayed valid -
 * the account menu appeared to do nothing.
 *
 * Submitting programmatically keeps the server action authoritative (session
 * row deleted, cookie cleared, redirect issued) while remaining immune to an
 * ancestor cancelling the click.
 */
export function SignOutButton({
  children,
  className,
  onSignedOut,
}: {
  children?: ReactNode;
  className?: string;
  onSignedOut?: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  return (
    <button
      aria-busy={pending}
      className={className}
      // Guard against double submission producing two sign-out requests.
      disabled={pending}
      onClick={async (event) => {
        event.preventDefault();
        if (pending) return;
        setPending(true);
        setFailed(false);
        // Drop user-scoped client caches before the server call so a slow
        // network cannot leave another account's cached UI readable.
        clearAuthenticatedClientState();
        try {
          await signOutAction();
          onSignedOut?.();
        } catch (error) {
          // `redirect()` inside a server action surfaces as a thrown control
          // signal; that is a successful sign-out, not a failure.
          if (
            error &&
            typeof error === "object" &&
            "digest" in error &&
            String((error as { digest?: unknown }).digest).startsWith(
              "NEXT_REDIRECT",
            )
          ) {
            throw error;
          }
          setPending(false);
          setFailed(true);
        }
      }}
      type="button"
    >
      <LogOut aria-hidden size={16} />
      {failed
        ? "Sign out failed — retry"
        : pending
          ? "Signing out…"
          : (children ?? "Sign out")}
    </button>
  );
}
