import { describe, expect, it } from "vitest";

import { notFound, redirect, unstable_rethrow } from "next/navigation";

/**
 * The stale digest check on the public profile route.
 *
 * `src/app/(public)/u/[username]/page.tsx` tested
 * `digest === "NEXT_NOT_FOUND"`. P0-1 established that Next 16 throws
 * `NEXT_HTTP_ERROR_FALLBACK;404` for `notFound()`, so that comparison had been
 * dead since the upgrade: a `notFound()` reaching that helper would have been
 * converted into an `{ error }` value instead of propagating as a 404.
 *
 * These tests pin the framework contract the fix relies on, so a future Next
 * upgrade that changes the digest format again fails here - loudly, in a unit
 * test - rather than silently degrading a 404 into a rendered page.
 */

/** The check exactly as it was written, kept to prove it is dead. */
function staleDigestCheck(error: unknown) {
  const digest = (error as { digest?: unknown } | null)?.digest;
  return (
    typeof digest === "string" &&
    (digest.startsWith("NEXT_REDIRECT") || digest === "NEXT_NOT_FOUND")
  );
}

function capture(throwing: () => void): unknown {
  try {
    throwing();
  } catch (error) {
    return error;
  }
  throw new Error("expected the call to throw");
}

describe("Next control-flow error handling on the public profile route", () => {
  it("confirms notFound() no longer uses the NEXT_NOT_FOUND digest", () => {
    const error = capture(() => notFound());

    expect((error as { digest?: string }).digest).toBe(
      "NEXT_HTTP_ERROR_FALLBACK;404",
    );
    // The precise reason the old check was dead.
    expect((error as { digest?: string }).digest).not.toBe("NEXT_NOT_FOUND");
  });

  it("demonstrates the stale check fails to recognise a real notFound()", () => {
    expect(staleDigestCheck(capture(() => notFound()))).toBe(false);
  });

  it("confirms the NEXT_REDIRECT half of the old check was still valid", () => {
    // This is why the fix must not regress redirects while fixing notFound.
    expect(staleDigestCheck(capture(() => redirect("/sign-in")))).toBe(true);
  });

  it("rethrows a notFound() through unstable_rethrow", () => {
    const error = capture(() => notFound());

    expect(() => unstable_rethrow(error)).toThrow();
  });

  it("rethrows a redirect() through unstable_rethrow", () => {
    const error = capture(() => redirect("/app/messages/conversation-1"));

    expect(() => unstable_rethrow(error)).toThrow();
  });

  it("lets an ordinary application error pass through without rethrowing", () => {
    // The helper must still convert genuine failures into an { error } value,
    // otherwise the client boundary cannot roll back optimistic state.
    expect(() => unstable_rethrow(new Error("connection reset"))).not.toThrow();
  });
});
