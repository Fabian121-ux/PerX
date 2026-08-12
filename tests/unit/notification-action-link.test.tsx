// @vitest-environment jsdom

import { act, fireEvent, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  openNotification: vi.fn(),
  push: vi.fn(),
}));

vi.mock("@/features/notifications/actions", () => ({
  openNotificationAction: mocks.openNotification,
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

  it("starts navigation feedback while the server reauthorizes the destination", async () => {
    let resolve: (() => void) | undefined;
    mocks.openNotification.mockReturnValue(
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

    expect(mocks.openNotification).toHaveBeenCalledWith("notification-1");
    expect(link.getAttribute("href")).toBe(
      "/app/messages/conversation-1?message=message-1",
    );
    expect(link.getAttribute("aria-busy")).toBe("true");

    await act(async () => {
      resolve?.();
      await Promise.resolve();
    });
    await waitFor(() => expect(link.getAttribute("aria-busy")).toBeNull());
  });

  it("falls back to router navigation when the server action fails", async () => {
    mocks.openNotification.mockRejectedValue(
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

    await waitFor(() =>
      expect(mocks.push).toHaveBeenCalledWith(
        "/app/messages/conversation-1?message=message-1",
      ),
    );
    await expect(view.findByText("Could not open this update")).resolves.toBeTruthy();
  });
});
