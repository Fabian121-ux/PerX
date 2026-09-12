// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import AdminError from "@/app/admin/error";

/**
 * The /admin boundary had three defects, all covered here:
 *
 *   a. it logged the entire error object, unlike the app segment which logs
 *      only {digest, kind, route, timestamp};
 *   b. its copy asserted a connectivity cause for every failure, including the
 *      missing-table schema fault that actually caused the outage;
 *   c. `reset()` re-ran the same failing query, so "Retry connection" looped
 *      forever with no state change.
 */
describe("admin error boundary", () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("does not claim a connectivity cause for an opaque production digest", () => {
    const error = Object.assign(new Error(""), { digest: "abc123" });
    render(<AdminError error={error} reset={vi.fn()} />);

    const body = document.body.textContent ?? "";
    expect(body).not.toMatch(/connection/i);
    expect(body).not.toMatch(/offline/i);
    expect(body).toMatch(/couldn't load/i);
  });

  it("logs only the redacted shape, never the raw error", () => {
    const error = Object.assign(
      new Error("prisma postgresql://user:secret@db:5432/perx"),
      { digest: "ref-987" },
    );
    render(<AdminError error={error} reset={vi.fn()} />);

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const [label, payload] = errorSpy.mock.calls[0] as [
      string,
      Record<string, unknown>,
    ];

    expect(label).toBe("[perx:error-boundary]");
    expect(Object.keys(payload).sort()).toEqual([
      "digest",
      "kind",
      "route",
      "timestamp",
    ]);
    expect(payload.route).toBe("/admin");
    expect(payload.digest).toBe("ref-987");

    const serialized = JSON.stringify(errorSpy.mock.calls);
    expect(serialized).not.toContain("postgresql://");
    expect(serialized).not.toContain("secret");
    expect(serialized).not.toContain("prisma");
  });

  it("omits retry where retry cannot change the outcome", () => {
    // 403: a capability failure. Retrying re-runs the same denied check.
    render(<AdminError error={{ status: 403 } as never} reset={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /try again/i })).toBeNull();
  });

  it("offers a working retry where retry can plausibly help", () => {
    const reset = vi.fn();
    render(<AdminError error={{ status: 503 } as never} reset={reset} />);

    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("returns the operator to the admin portal, not the public root", () => {
    render(<AdminError error={{ status: 500 } as never} reset={vi.fn()} />);
    const link = screen
      .getAllByRole("link")
      .find((node) => node.getAttribute("href") === "/admin");
    expect(link).toBeDefined();
  });

  it("never renders the raw message to the operator", () => {
    const error = Object.assign(
      new Error("The table `public.TraderApplication` does not exist"),
      { digest: "ref-1" },
    );
    render(<AdminError error={error} reset={vi.fn()} />);

    const body = document.body.textContent ?? "";
    expect(body).not.toContain("TraderApplication");
    expect(body).not.toContain("does not exist");
    expect(body).toContain("ref-1");
  });
});
