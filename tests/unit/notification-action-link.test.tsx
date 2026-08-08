// @vitest-environment jsdom

import { act, fireEvent, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ markRead: vi.fn() }));

vi.mock("@/features/notifications/actions", () => ({
  markNotificationAsReadAction: mocks.markRead,
}));

import { NotificationActionLink } from "@/components/notifications/notification-action-link";

describe("notification action navigation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("starts navigation feedback and marks read without blocking the link", async () => {
    let resolve: (() => void) | undefined;
    mocks.markRead.mockReturnValue(
      new Promise<void>((complete) => {
        resolve = complete;
      }),
    );
    const refresh = vi.fn();
    window.addEventListener("perx-unread-refresh", refresh);

    const view = render(
      <NotificationActionLink
        ariaLabel="Open message"
        href="/app/messages/conversation-1?message=message-1"
        notificationId="notification-1"
      >
        Open
      </NotificationActionLink>,
    );
    const link = view.getByRole("link", { name: "Open message" });

    fireEvent.click(link);

    expect(mocks.markRead).toHaveBeenCalledWith("notification-1");
    expect(link.getAttribute("href")).toBe(
      "/app/messages/conversation-1?message=message-1",
    );
    expect(link.getAttribute("aria-busy")).toBe("true");

    await act(async () => {
      resolve?.();
      await Promise.resolve();
    });
    expect(refresh).toHaveBeenCalledTimes(1);
    window.removeEventListener("perx-unread-refresh", refresh);
  });
});
