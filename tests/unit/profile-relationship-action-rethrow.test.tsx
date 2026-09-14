import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Exercises the REAL `runRelationshipAction` helper in the public profile page.
 *
 * The helper is module-private, so it is reached the way production reaches it:
 * render the page, capture the server actions it hands to
 * `ProfileRelationshipActions`, and invoke them.
 *
 * The defect: the helper hand-rolled a digest comparison and tested
 * `digest === "NEXT_NOT_FOUND"`. Next 16 throws `NEXT_HTTP_ERROR_FALLBACK;404`,
 * so a `notFound()` raised by a wrapped action was swallowed and returned to
 * the client as an error string instead of producing a 404.
 */

const mocks = vi.hoisted(() => ({
  blockUserAction: vi.fn(),
  getCurrentUser: vi.fn(),
  getPublicProfileResult: vi.fn(),
  startConversationAction: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/data/profiles", () => ({
  getPublicProfileResult: mocks.getPublicProfileResult,
}));
vi.mock("@/lib/db/prisma", () => ({
  getPrisma: () => ({
    connection: { findFirst: vi.fn().mockResolvedValue(null) },
    blockedUser: { findFirst: vi.fn().mockResolvedValue(null) },
    review: { findMany: vi.fn().mockResolvedValue([]) },
    opportunity: { findMany: vi.fn().mockResolvedValue([]) },
  }),
}));
vi.mock("@/features/network/actions", () => ({
  acceptConnectionAction: vi.fn(),
  blockUserAction: mocks.blockUserAction,
  cancelConnectionRequestAction: vi.fn(),
  disconnectAction: vi.fn(),
  rejectConnectionAction: vi.fn(),
  requestConnectionAction: vi.fn(),
  startConversationAction: mocks.startConversationAction,
  unblockUserAction: vi.fn(),
}));

// `PublicPageShell` renders the async `SiteHeader`, which suspends under
// `renderToStaticMarkup`. It is irrelevant to the helper under test.
vi.mock("@/components/standard-page", () => ({
  PublicPageShell: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

/**
 * Capture the server actions the page passes down, so the private helper can be
 * invoked directly rather than inferred from rendered markup.
 */
type RelationshipActions = Record<string, () => Promise<unknown>>;

const captured: { actions?: RelationshipActions } = {};
vi.mock("@/components/network/profile-relationship-actions", () => ({
  ProfileRelationshipActions: (props: {
    actions: Record<string, () => Promise<unknown>>;
  }) => {
    captured.actions = props.actions;
    return null;
  },
  ProfileReportAction: () => null,
}));

import PublicProfilePage from "@/app/(public)/u/[username]/page";

const PROFILE = {
  averageRating: 0,
  bio: "",
  completedDeals: 0,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  emailVerified: true,
  headline: "Builder",
  id: "user-2",
  location: null,
  name: "Target User",
  profileCompleteness: 50,
  profileImageUrl: null,
  publicReviewCount: 0,
  skills: [],
  trustScore: 10,
  username: "target",
};

async function renderAndCaptureActions(): Promise<RelationshipActions> {
  captured.actions = undefined;
  renderToStaticMarkup(
    await PublicProfilePage({
      params: Promise.resolve({ username: "target" }),
    }),
  );
  const actions = captured.actions;
  if (!actions) throw new Error("relationship actions were not wired");
  return actions;
}

describe("public profile relationship action control-flow handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentUser.mockResolvedValue({ id: "user-1", roles: [] });
    mocks.getPublicProfileResult.mockResolvedValue({
      profile: PROFILE,
      unavailable: false,
    });
  });

  it("propagates a notFound() raised by a wrapped action", async () => {
    const { notFound } = await import("next/navigation");
    mocks.blockUserAction.mockImplementation(() => {
      notFound();
    });

    const actions = await renderAndCaptureActions();

    // The regression: with the stale digest check this resolved to
    // { error: "NEXT_HTTP_ERROR_FALLBACK;404" } and rendered instead of 404ing.
    await expect(actions.block()).rejects.toMatchObject({
      digest: "NEXT_HTTP_ERROR_FALLBACK;404",
    });
  });

  it("propagates a redirect() raised by a wrapped action", async () => {
    const { redirect } = await import("next/navigation");
    mocks.startConversationAction.mockImplementation(() => {
      redirect("/app/messages/conversation-1");
    });

    const actions = await renderAndCaptureActions();

    await expect(actions.message()).rejects.toMatchObject({
      digest: expect.stringContaining("NEXT_REDIRECT"),
    });
  });

  it("still converts an ordinary failure into an error value", async () => {
    mocks.blockUserAction.mockRejectedValue(new Error("connection reset"));

    const actions = await renderAndCaptureActions();

    // The client boundary needs a value to roll back optimistic state.
    await expect(actions.block()).resolves.toEqual({
      error: "connection reset",
    });
  });

  it("returns a generic message when the failure carries no message", async () => {
    mocks.blockUserAction.mockRejectedValue(new Error(""));

    const actions = await renderAndCaptureActions();

    await expect(actions.block()).resolves.toEqual({
      error: "Something went wrong. Please try again.",
    });
  });

  it("returns an empty result on success", async () => {
    mocks.blockUserAction.mockResolvedValue(undefined);

    const actions = await renderAndCaptureActions();

    await expect(actions.block()).resolves.toEqual({});
  });
});
