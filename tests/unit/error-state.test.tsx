// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ErrorState } from "@/components/system/error-state";

/**
 * Fault-injection coverage for the shared error surface.
 *
 * The defect these guard against was a boundary telling every user that a
 * failure was "typically due to a temporary connection issue" - including for
 * server errors, which have nothing to do with the user's connection.
 */
describe("ErrorState", () => {
  afterEach(cleanup);

  it("does not claim a network failure for an unknown server error", () => {
    render(<ErrorState error={{ status: 500 }} surface="your workspace" />);
    const body = document.body.textContent ?? "";
    expect(body).not.toMatch(/connection/i);
    expect(body).not.toMatch(/offline/i);
    expect(screen.getByRole("heading").textContent ?? "").toMatch(
      /something went wrong/i,
    );
  });

  it("does not claim a network failure for an opaque production digest", () => {
    const opaque = Object.assign(new Error(""), { digest: "abc123" });
    render(<ErrorState error={opaque} surface="your workspace" />);
    const body = document.body.textContent ?? "";
    expect(body).not.toMatch(/connection/i);
    expect(body).toMatch(/couldn't load/i);
  });

  it("mentions connectivity only for a real transport failure", () => {
    render(<ErrorState error={new TypeError("Failed to fetch")} />);
    expect(document.body.textContent ?? "").toMatch(/connection/i);
  });

  it("offers a working retry that invokes reset", () => {
    const reset = vi.fn();
    render(<ErrorState error={{ status: 500 }} onRetry={reset} />);
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("does not offer retry where retry cannot help", () => {
    const reset = vi.fn();
    render(<ErrorState error={{ status: 403 }} onRetry={reset} />);
    expect(screen.queryByRole("button", { name: /try again/i })).toBeNull();
  });

  it("sends an expired session to sign-in rather than offering retry", () => {
    render(<ErrorState error={{ status: 401 }} onRetry={vi.fn()} />);
    expect(
      screen.getByRole("link", { name: /sign in/i }).getAttribute("href"),
    ).toBe("/sign-in");
    expect(screen.queryByRole("button", { name: /try again/i })).toBeNull();
  });

  it("keeps a feature gate distinct from not found", () => {
    const { unmount } = render(<ErrorState error={{ status: 403 }} />);
    expect(document.body.textContent ?? "").not.toMatch(/not found/i);
    unmount();
    render(<ErrorState error={{ status: 404 }} />);
    expect(document.body.textContent ?? "").toMatch(/not found/i);
  });

  it("surfaces a reference id without leaking internals", () => {
    const error = Object.assign(
      new Error("prisma postgresql://user:secret@db:5432/perx"),
      { digest: "ref-987" },
    );
    render(<ErrorState error={error} />);
    const body = document.body.textContent ?? "";
    expect(body).toContain("ref-987");
    expect(body).not.toContain("postgresql://");
    expect(body).not.toContain("secret");
  });
});
