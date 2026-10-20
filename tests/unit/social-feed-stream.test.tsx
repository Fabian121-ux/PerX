// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/social/social-post-card", () => ({
  SocialPostCard: ({ post }: { post: { body: string; id: string } }) =>
    <article data-testid={post.id}>{post.body}</article>,
}));

import { SocialFeedStream } from "@/components/social/social-feed-stream";

const posts = [
  { kind: "SOCIAL_POST" as const, id: "a", body: "Original update", publishedAt: "2026-10-20", author: { id: "a", name: "A", username: "a", imageUrl: null }, reactionCount: 0, commentCount: 0 },
];
let notify: ((entries: { isIntersecting: boolean }[]) => void) | undefined;
const observe = vi.fn();
const disconnect = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  notify = undefined;
  vi.stubGlobal("IntersectionObserver", class {
    constructor(cb: (entries: { isIntersecting: boolean }[]) => void) { notify = cb; }
    observe = observe;
    disconnect = disconnect;
  });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("community feed loops through actual paginated posts", () => {
  it("does not duplicate posts returned on an overlapping cursor page", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: [
        posts[0], { ...posts[0], id: "b", body: "Second real update" },
      ], nextCursor: null }),
    });
    vi.stubGlobal("fetch", fetcher);
    render(<SocialFeedStream initialItems={posts} initialNextCursor="page-2" />);
    expect(screen.getAllByRole("article")).toHaveLength(1);
    await act(async () => {
      notify?.([{ isIntersecting: true }]);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(fetcher).toHaveBeenCalledWith("/api/social-feed?cursor=page-2", expect.objectContaining({ cache: "no-store" }));
    expect(screen.getAllByRole("article")).toHaveLength(2);
    expect(screen.getAllByText("Original update")).toHaveLength(1);
    expect(screen.getByText("Second real update")).toBeInTheDocument();
    expect(screen.getByText(/up to date with community posts/i)).toBeInTheDocument();
  });

  it("keeps current posts visible when a page request fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    render(<SocialFeedStream initialItems={posts} initialNextCursor="page-2" />);
    await act(async () => {
      notify?.([{ isIntersecting: true }]);
      await Promise.resolve();
    });
    expect(screen.getByText("Original update")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});
