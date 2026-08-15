// @vitest-environment jsdom

import { act, fireEvent, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  markRead: vi.fn(),
  push: vi.fn(),
}));

vi.mock("@/features/notifications/actions", () => ({
  markNotificationAsReadAction: mocks.markRead,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
}));

import { NotificationActionLink } from "@/components/notifications/notification-action-link";
import { FeedbackProvider } from "@/components/ui/feedback-provider";

describe("notification action navigation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("starts navigation before mark-read resolves", async () => {
    let resolve: (() => void) | undefined;
    mocks.markRead.mockReturnValue(
      new Promise<void>((complete) => {
        resolve = complete;
      }),
    );

    const view = render(
      <FeedbackProvider>
        <NotificationActionLink
          ariaLabel="Open message"
          href="/app/messages/conversation-1?message=message-1"
          notificationId="notification-1"
        >
          Open
        </NotificationActionLink>
      </FeedbackProvider>,
    );
    const link = view.getByRole("link", { name: "Open message" });

    fireEvent.click(link);

    expect(mocks.markRead).toHaveBeenCalledWith("notification-1");
    expect(mocks.push).toHaveBeenCalledWith(
      "/app/messages/conversation-1?message=message-1",
    );
    expect(link.getAttribute("href")).toBe(
      "/app/messages/conversation-1?message=message-1",
    );
    expect(link.getAttribute("aria-busy")).toBe("true");
    expect(link.textContent).toContain("Opening...");

    await act(async () => {
      resolve?.();
      await Promise.resolve();
    });
    expect(link.getAttribute("aria-busy")).toBe("true");
  });

  it("keeps navigation independent when mark-read fails", async () => {
    mocks.markRead.mockRejectedValue(
      new Error("Database is temporarily unavailable."),
    );

    const view = render(
      <FeedbackProvider>
        <NotificationActionLink
          ariaLabel="Open message"
          href="/app/messages/conversation-1?message=message-1"
          notificationId="notification-1"
        >
          Open
        </NotificationActionLink>
      </FeedbackProvider>,
    );
    const link = view.getByRole("link", { name: "Open message" });

    fireEvent.click(link);

    expect(mocks.push).toHaveBeenCalledWith(
      "/app/messages/conversation-1?message=message-1",
    );
    await expect(
      view.findByText("Could not mark this update read"),
    ).resolves.toBeTruthy();
  });
});
