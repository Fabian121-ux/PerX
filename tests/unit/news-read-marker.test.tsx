// @vitest-environment jsdom

import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  markRead: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("@/features/notifications/actions", () => ({
  markVisibleNewsAsReadAction: mocks.markRead,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));

import { NewsReadMarker } from "@/components/news/news-read-marker";

describe("News read marker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.markRead.mockResolvedValue(undefined);
  });

  afterEach(() => cleanup());

  it("uses the explicit read action and refreshes live indicators", async () => {
    const indicatorRefresh = vi.fn();
    window.addEventListener("perx-unread-refresh", indicatorRefresh);

    render(
      <NewsReadMarker
        notificationIds={["notification-1", "notification-2"]}
      />,
    );

    await waitFor(() => {
      expect(mocks.markRead).toHaveBeenCalledWith([
        "notification-1",
        "notification-2",
      ]);
      expect(indicatorRefresh).toHaveBeenCalledTimes(1);
      expect(mocks.refresh).toHaveBeenCalledTimes(1);
    });

    window.removeEventListener("perx-unread-refresh", indicatorRefresh);
  });

  it("does not mutate when the page has no unread News", () => {
    render(<NewsReadMarker notificationIds={[]} />);
    expect(mocks.markRead).not.toHaveBeenCalled();
  });
});
