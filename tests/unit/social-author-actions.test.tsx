// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  blockUserAction: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("@/features/network/actions", () => ({
  blockUserAction: mocks.blockUserAction,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));

import { FeedbackProvider } from "@/components/ui/feedback-provider";
import { SocialAuthorActions } from "@/components/social/social-author-actions";
import { SocialPostCard } from "@/components/social/social-post-card";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.blockUserAction.mockResolvedValue(undefined);
});
afterEach(cleanup);

function showMenu() {
  const trigger = screen.getByRole("button", { name: "More options for Ada" });
  fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false, pointerType: "mouse" });
}

describe("social feed profile moderation actions", () => {
  it("offers a real user report and a route to unblock, without inventing POST reporting", async () => {
    render(
      <FeedbackProvider>
        <SocialAuthorActions authorId="author-123" authorName="Ada" username="ada" />
      </FeedbackProvider>,
    );
    showMenu();
    expect(await screen.findByRole("menuitem", { name: "Report member" })).toHaveAttribute(
      "href", "/app/reports/new?targetType=USER&targetId=author-123",
    );
    expect(screen.getByRole("menuitem", { name: "Manage blocked users" })).toHaveAttribute(
      "href", "/app/settings/blocked",
    );
    expect(screen.getByRole("menuitem", { name: "View profile" })).toHaveAttribute("href", "/u/ada");
  });

  it("asks for confirmation and blocks only once, with immediate feedback", async () => {
    const onBlocked = vi.fn();
    render(
      <FeedbackProvider>
        <SocialAuthorActions authorId="author-123" authorName="Ada" username="ada" onBlocked={onBlocked} />
      </FeedbackProvider>,
    );
    showMenu();
    fireEvent.click(await screen.findByRole("menuitem", { name: "Block member" }));
    expect(mocks.blockUserAction).not.toHaveBeenCalled();
    expect(await screen.findByText("Block Ada?")).toBeInTheDocument();
    const confirmDialog = screen.getByRole("dialog");
    const confirmButton = Array.from(confirmDialog.querySelectorAll("button"))
      .find((button) => button.textContent?.includes("Block member"));
    if (!confirmButton) throw new Error("Missing confirm button");
    await act(async () => {
      fireEvent.click(confirmButton);
      await Promise.resolve();
    });
    await waitFor(() => expect(mocks.blockUserAction).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(onBlocked).toHaveBeenCalledWith("author-123"));
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });

  it("does not offer to block the logged-in author of their own update", () => {
    render(
      <FeedbackProvider>
        <SocialPostCard
          viewerId="author-123"
          post={{
            kind: "SOCIAL_POST",
            id: "post-123",
            body: "My own update",
            publishedAt: "2026-10-20T00:00:00.000Z",
            reactionCount: 0,
            commentCount: 0,
            viewerReaction: null,
            author: { id: "author-123", username: "ada", name: "Ada", imageUrl: null },
          }}
        />
      </FeedbackProvider>,
    );
    expect(screen.queryByRole("button", { name: "More options for Ada" })).not.toBeInTheDocument();
  });
});
