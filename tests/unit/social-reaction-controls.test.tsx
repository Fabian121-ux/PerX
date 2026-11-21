// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SocialPostView } from "@/lib/social/contracts";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/features/social/actions", () => ({ setPostReactionAction: vi.fn() }));
vi.mock("@/components/feed/share-button", () => ({ ShareButton: () => null }));
vi.mock("@/components/social/social-author-actions", () => ({ SocialAuthorActions: () => null }));

import { SocialPostCard } from "@/components/social/social-post-card";

const post: SocialPostView = {
  kind: "SOCIAL_POST",
  id: "post-1",
  body: "New community update",
  author: { id: "author-1", name: "Ada", username: "ada", imageUrl: null },
  publishedAt: "2026-11-20T12:00:00.000Z",
  commentCount: 0,
  reactionCount: 1,
  viewerReaction: "LIKE",
};

afterEach(cleanup);

describe("mobile social reaction controls", () => {
  it("renders visible, touch-sized controls with a clear selected state", () => {
    render(<SocialPostCard post={post} viewerId="viewer-1" />);
    const like = screen.getByRole("button", { name: "Like" });
    const insightful = screen.getByRole("button", { name: "Insightful" });
    expect(like).toHaveAttribute("aria-pressed", "true");
    expect(insightful).toHaveAttribute("aria-pressed", "false");
    expect(like).toHaveClass("min-h-12", "rounded-xl", "border");
    expect(insightful).toHaveClass("min-h-12", "rounded-xl", "border");
    expect(like.className).toContain("bg-[color:var(--px-primary-soft)]");
    expect(like.closest("form")?.querySelector(".grid-cols-2")).toBeTruthy();
  });
});
