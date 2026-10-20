// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  block: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("@/features/network/actions", () => ({ blockUserAction: mocks.block }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));

import { SocialCommentsList } from "@/components/social/social-comments-list";
import { FeedbackProvider } from "@/components/ui/feedback-provider";

const comments = [
  {
    id: "comment-1", body: "First response", createdAt: "2026-10-20T12:00:00.000Z",
    updatedAt: "2026-10-20T12:00:00.000Z",
    author: { id: "ada-id", name: "Ada", username: "ada", imageUrl: null },
  },
  {
    id: "comment-2", body: "Second response", createdAt: "2026-10-20T12:30:00.000Z",
    updatedAt: "2026-10-20T12:30:00.000Z",
    author: { id: "ada-id", name: "Ada", username: "ada", imageUrl: null },
  },
  {
    id: "comment-3", body: "My own response", createdAt: "2026-10-20T13:00:00.000Z",
    updatedAt: "2026-10-20T13:00:00.000Z",
    author: { id: "me", name: "Me", username: "me", imageUrl: null },
  },
];

beforeEach(() => { vi.clearAllMocks(); mocks.block.mockResolvedValue(undefined); });
afterEach(cleanup);

describe("social comment safety", () => {
  it("provides a direct comment permalink and member/content reporting", async () => {
    render(
      <FeedbackProvider>
        <SocialCommentsList comments={comments} postId="post-1" viewerId="me" />
      </FeedbackProvider>,
    );
    expect(screen.getByRole("link", { name: "Link to comment by Ada" })).toHaveAttribute(
      "href", "/posts/post-1#comment-comment-1",
    );
    const menus = screen.getAllByRole("button", { name: "More options for Ada" });
    fireEvent.pointerDown(menus[0], { button: 0, ctrlKey: false, pointerType: "mouse" });
    expect(await screen.findByRole("menuitem", { name: "Report comment" })).toHaveAttribute(
      "href", "/app/reports/new?targetType=OTHER_CONTENT&targetId=COMMENT%3Acomment-1",
    );
    expect(screen.getByRole("menuitem", { name: "Report member" })).toHaveAttribute(
      "href", "/app/reports/new?targetType=USER&targetId=ada-id",
    );
    expect(screen.getByText("My own response")).toBeInTheDocument();
    expect(screen.getByText("Edit comment")).toBeInTheDocument();
  });

  it("hides every comment from a blocked author only after confirmed success", async () => {
    render(
      <FeedbackProvider>
        <SocialCommentsList comments={comments} postId="post-1" viewerId="me" />
      </FeedbackProvider>,
    );
    fireEvent.pointerDown(
      screen.getAllByRole("button", { name: "More options for Ada" })[0],
      { button: 0, ctrlKey: false, pointerType: "mouse" },
    );
    fireEvent.click(await screen.findByRole("menuitem", { name: "Block member" }));
    expect(screen.getByText("First response")).toBeInTheDocument();
    const dialog = await screen.findByRole("dialog");
    const confirmation = Array.from(dialog.querySelectorAll("button")).find((node) =>
      node.textContent?.includes("Block member"),
    );
    if (!confirmation) throw new Error("Block confirmation missing");
    await act(async () => { fireEvent.click(confirmation); await Promise.resolve(); });
    await waitFor(() => expect(mocks.block).toHaveBeenCalledWith("ada-id"));
    await waitFor(() => expect(screen.queryByText("First response")).not.toBeInTheDocument());
    expect(screen.queryByText("Second response")).not.toBeInTheDocument();
    expect(screen.getByText("My own response")).toBeInTheDocument();
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });

  it("does not offer guests moderation buttons or block the comment's own author", () => {
    const { rerender } = render(
      <FeedbackProvider>
        <SocialCommentsList comments={comments} postId="post-1" />
      </FeedbackProvider>,
    );
    expect(screen.queryByRole("button", { name: /More options for/ })).not.toBeInTheDocument();
    rerender(
      <FeedbackProvider>
        <SocialCommentsList comments={comments} postId="post-1" viewerId="me" />
      </FeedbackProvider>,
    );
    expect(screen.queryByRole("button", { name: "More options for Me" })).not.toBeInTheDocument();
  });
});
