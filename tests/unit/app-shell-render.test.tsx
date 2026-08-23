// @vitest-environment jsdom

import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/app",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("next/link", async () => {
  const React = await import("react");
  return {
    default: ({
      children,
      href,
      ...props
    }: {
      children: React.ReactNode;
      href: string;
      [key: string]: unknown;
    }) => React.createElement("a", { ...props, href }, children),
  };
});

import { AppShell } from "@/components/layout/app-shell";
import type { CurrentUser } from "@/lib/auth/session";
import type { UnreadCounts } from "@/lib/data/unread-counts";

const counts: UnreadCounts = {
  generalActivity: 0,
  pendingConnectionRequests: 0,
  unreadConversations: 0,
  unreadNews: 0,
};

const user = {
  accountClassification: "PUBLIC_BETA_USER",
  createdAt: new Date("2026-01-01"),
  email: "viewer@perx.test",
  emailVerifiedAt: null,
  id: "viewer-1",
  imageUrl: null,
  name: "Viewer One",
  onboardingDismissedAt: null,
  profile: null,
  roles: ["MEMBER"],
  username: "viewer",
  verificationStatus: "UNVERIFIED",
} as unknown as CurrentUser;

/**
 * Stands in for route content such as the Home feed.
 *
 * Render counting is delegated to a `vi.fn()` rather than incrementing a
 * variable in the component body, which the React lint rules correctly reject
 * as a render side effect.
 */
const routeContentRendered = vi.fn();
function RouteContent() {
  routeContentRendered();
  return <div data-testid="route-content">content</div>;
}

describe("app shell rendering", () => {
  beforeEach(() => {
    routeContentRendered.mockClear();
    vi.clearAllMocks();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: async () => ({ ...counts, unreadConversations: 3 }),
        ok: true,
      }),
    );
    vi.stubGlobal(
      "BroadcastChannel",
      class {
        addEventListener() {}
        close() {}
        postMessage() {}
      },
    );
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        observe() {}
        disconnect() {}
        unobserve() {}
        takeRecords() {
          return [];
        }
      },
    );
    // jsdom implements neither of these, and the shell's responsive and
    // keyboard providers both depend on them.
    window.matchMedia = vi.fn().mockReturnValue({
      addEventListener: vi.fn(),
      matches: true,
      removeEventListener: vi.fn(),
    }) as unknown as typeof window.matchMedia;
    Element.prototype.scrollTo = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    cleanup();
  });

  it("does not re-render route content when unread counts refresh", async () => {
    vi.useFakeTimers();
    render(
      <AppShell unreadCounts={counts} user={user}>
        <RouteContent />
      </AppShell>,
    );
    await act(async () => {});
    const initialRenders = routeContentRendered.mock.calls.length;
    expect(initialRenders).toBeGreaterThan(0);

    /*
      The shell polls `/api/unread-counts` every 15 seconds. `children` arrives
      as an already-created element, so React reuses it and the badge update
      must not re-render the route beneath it - otherwise a scrolled Home feed
      would re-render every 15 seconds for the life of the session.
    */
    await act(async () => {
      await vi.advanceTimersByTimeAsync(16_000);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(16_000);
    });

    expect(routeContentRendered.mock.calls.length).toBe(initialRenders);
  });

  it("stops polling after unmount", async () => {
    vi.useFakeTimers();
    const view = render(
      <AppShell unreadCounts={counts} user={user}>
        <RouteContent />
      </AppShell>,
    );
    await act(async () => {});
    view.unmount();
    const callsAfterUnmount = (globalThis.fetch as ReturnType<typeof vi.fn>).mock
      .calls.length;

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });

    // A leaked interval would keep querying the database forever.
    expect(
      (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length,
    ).toBe(callsAfterUnmount);
  });
});
