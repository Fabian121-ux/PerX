// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { isValidElement, type ReactNode } from "react";

const mocks = vi.hoisted(() => ({
  user: vi.fn(),
  feed: vi.fn(),
  save: vi.fn(),
}));
vi.mock("@/lib/auth/session", () => ({ getCurrentUser: mocks.user }));
vi.mock("@/lib/data/public-feed", () => ({ getPublicFeedResult: mocks.feed }));
vi.mock("@/features/opportunities/actions", () => ({
  setOpportunityBookmarkAction: mocks.save,
}));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`redirect:${path}`);
  },
}));
vi.mock("@/components/sponsored/sponsored-slot", () => ({
  SponsoredSlot: () => null,
}));
vi.mock("@/components/layout/site-header", () => ({ SiteHeader: () => null }));
vi.mock("@/components/standard-page", () => ({
  PublicPageShell: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@/components/auth/sign-in-form", () => ({ SignInForm: () => null }));
import Home from "@/app/page";
import SignIn from "@/app/(auth)/sign-in/page";
import { calculateTrustSummary } from "@/lib/trust/engine";

const post = {
  id: "public-post",
  slug: "public-post",
  title: "Build a better workspace",
  summary: "A real public opportunity",
  authorId: "public-author",
  authorName: "Public founder",
  authorUsername: "founder",
  authorAvatarUrl: null,
  imageUrl: null,
  imageAlt: "",
  publishedAt: "2026-09-01T12:00:00.000Z",
  type: "SERVICE",
  location: null,
  remote: true,
  currency: "NGN",
  budgetMinMinor: null,
  budgetMaxMinor: null,
  trust: calculateTrustSummary({
    averageRating: 0,
    completedDeals: 0,
    profileCompleteness: 0,
    verificationStatus: "UNVERIFIED",
  }),
};
function textInTree(node: ReactNode): string {
  if (Array.isArray(node)) return node.map(textInTree).join(" ");
  if (isValidElement<{ children?: ReactNode }>(node))
    return textInTree(node.props.children);
  return typeof node === "string" ? node : "";
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.user.mockResolvedValue(null);
  mocks.feed.mockResolvedValue({ posts: [post], unavailable: false });
});
afterEach(cleanup);
it("makes anonymous root a single public feed without the marketing stack", async () => {
  const tree = await Home();
  expect(textInTree(tree)).not.toMatch(
    /Main activity paths|Built around the real workflow|Discover trusted people|Partnership opportunities|Enquiry-first commercial discovery/,
  );
  const view = render(tree);
  expect(view.getByRole("heading", { name: post.title })).toBeTruthy();
  expect(mocks.feed).toHaveBeenCalledWith();
  expect(view.getByRole("main").className).toContain("max-w-[640px]");
  expect(view.getByRole("main").className).toContain("min-w-0");
  expect(view.container.querySelector("article")?.className).toContain(
    "min-w-0",
  );
  expect(view.getByRole("link", { name: "Sign in" }).getAttribute("href")).toBe(
    "/sign-in",
  );
  expect(view.getByRole("link", { name: "Sign up" }).getAttribute("href")).toBe(
    "/sign-up",
  );
});
it("redirects authenticated root before fetching public posts", async () => {
  mocks.user.mockResolvedValue({ id: "member" });
  await expect(Home()).rejects.toThrow("redirect:/app");
  expect(mocks.feed).not.toHaveBeenCalled();
});
it("renders an anonymous save link with a safe content return path, never a mutation button", async () => {
  const view = render(await Home());
  const link = view.getByRole("link", { name: "Sign in to save" });
  const href = new URL(link.getAttribute("href")!, "https://ptahx.local");
  expect(href.pathname).toBe("/sign-in");
  expect(href.searchParams.get("next")).toBe("/opportunities/public-post");
  expect(view.queryByRole("button", { name: /save/i })).toBeNull();
  expect(mocks.save).not.toHaveBeenCalled();
});
it("keeps password recovery reachable from sign-in", async () => {
  const view = render(await SignIn({ searchParams: Promise.resolve({}) }));
  expect(
    view.getByRole("link", { name: "Recover password" }).getAttribute("href"),
  ).toBe("/password-recovery");
});
it.each([false, true])(
  "renders compact honest empty/unavailable state (unavailable=%s)",
  async (unavailable) => {
    mocks.feed.mockResolvedValue({ posts: [], unavailable });
    const view = render(await Home());
    expect(
      view.getByRole("heading", {
        name: unavailable
          ? "Public feed temporarily unavailable"
          : "No public posts yet",
      }),
    ).toBeTruthy();
    expect(view.container.querySelector("article")).toBeNull();
    expect(view.container.textContent).not.toMatch(
      /connect with founders|Main activity paths/,
    );
  },
);

it("keeps guest return paths local even with hostile slug characters", async () => {
  mocks.feed.mockResolvedValue({
    posts: [
      { ...post, slug: "//evil.example/\\redirect?next=https://evil.example" },
    ],
    unavailable: false,
  });
  const view = render(await Home());
  const href = new URL(
    view.getByRole("link", { name: "Sign in to save" }).getAttribute("href")!,
    "https://ptahx.local",
  );
  const returnUrl = new URL(
    href.searchParams.get("next")!,
    "https://ptahx.local",
  );
  expect(href.origin).toBe("https://ptahx.local");
  expect(returnUrl.origin).toBe("https://ptahx.local");
  expect(returnUrl.pathname.startsWith("/opportunities/")).toBe(true);
});
