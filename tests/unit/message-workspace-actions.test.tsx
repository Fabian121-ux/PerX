// @vitest-environment jsdom

import {
  act,
  cleanup,
  fireEvent,
  render as testingLibraryRender,
  waitFor,
  within,
} from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  blockUserAction: vi.fn(),
  deleteMessageAction: vi.fn(),
  editMessageAction: vi.fn(),
  markConversationReadAction: vi.fn(),
  removeConversationForMeAction: vi.fn(),
  sendMessageAction: vi.fn(),
}));

vi.mock("@/features/messages/actions", () => ({
  deleteMessageAction: mocks.deleteMessageAction,
  editMessageAction: mocks.editMessageAction,
  markConversationReadAction: mocks.markConversationReadAction,
  removeConversationForMeAction: mocks.removeConversationForMeAction,
  sendMessageAction: mocks.sendMessageAction,
}));
vi.mock("@/features/network/actions", () => ({
  blockUserAction: mocks.blockUserAction,
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/app/messages/conversation-1",
}));

import { MessageWorkspace } from "@/components/messages/message-workspace";
import { FeedbackProvider } from "@/components/ui/feedback-provider";

function render(ui: ReactElement) {
  return testingLibraryRender(<FeedbackProvider>{ui}</FeedbackProvider>);
}

function workspace() {
  return (
    <MessageWorkspace
      conversations={[
        {
          id: "conversation-1",
          messages: [
            {
              body: "Incoming action target",
              canMutate: true,
              createdAt: "2026-08-13T10:00:00.000Z",
              id: "message-incoming",
              senderId: "user-2",
              senderName: "Other User",
            },
            {
              body: "Own editable message",
              canMutate: true,
              createdAt: "2026-08-13T10:01:00.000Z",
              id: "message-own",
              senderId: "user-1",
              senderName: "Current User",
            },
            {
              body: "Own expired message",
              canMutate: false,
              createdAt: "2026-08-12T10:00:00.000Z",
              id: "message-expired",
              senderId: "user-1",
              senderName: "Current User",
            },
          ],
          participantId: "user-2",
          participantName: "Other User",
          participantUsername: "other-user",
        },
      ]}
      currentUserId="user-1"
      defaultConversationId="conversation-1"
    />
  );
}

function bubble(view: ReturnType<typeof render>, id: string) {
  const element = view.container.querySelector<HTMLElement>(
    `[data-message-id="${id}"]`,
  );
  if (!element) throw new Error(`Message bubble ${id} missing`);
  return element;
}

describe("message workspace gestures and actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    window.history.replaceState(null, "", "/");
    vi.stubGlobal(
      "EventSource",
      class {
        addEventListener() {}
        close() {}
      },
    );
    Element.prototype.scrollIntoView = vi.fn();
    HTMLDivElement.prototype.scrollTo = vi.fn();
    Object.defineProperties(HTMLDivElement.prototype, {
      clientHeight: { configurable: true, get: () => 200 },
      scrollHeight: { configurable: true, get: () => 1000 },
    });
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    mocks.markConversationReadAction.mockResolvedValue({ success: true });
    mocks.sendMessageAction.mockResolvedValue({ success: true });
    mocks.editMessageAction.mockResolvedValue({ success: true });
    mocks.deleteMessageAction.mockResolvedValue({ success: true });
    mocks.removeConversationForMeAction.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    cleanup();
  });

  it("opens on long press and never also replies", async () => {
    const view = render(workspace());
    await act(async () => {});
    vi.useFakeTimers();
    const incoming = bubble(view, "message-incoming");
    const trigger = within(incoming).getByLabelText("Message actions");

    fireEvent.touchStart(incoming, {
      touches: [{ clientX: 10, clientY: 10 }],
    });
    act(() => vi.advanceTimersByTime(499));
    expect(trigger.getAttribute("aria-expanded")).toBe("false");

    act(() => vi.advanceTimersByTime(1));
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    fireEvent.touchEnd(incoming, {
      changedTouches: [{ clientX: 10, clientY: 10 }],
    });
    expect(view.queryByText("Replying to Other User")).toBeNull();
  }, 15_000);

  it("cancels long press on movement and touch cancellation", async () => {
    const view = render(workspace());
    await act(async () => {});
    vi.useFakeTimers();
    const incoming = bubble(view, "message-incoming");
    const trigger = within(incoming).getByLabelText("Message actions");

    fireEvent.touchStart(incoming, {
      touches: [{ clientX: 10, clientY: 10 }],
    });
    fireEvent.touchMove(incoming, {
      touches: [{ clientX: 25, clientY: 10 }],
    });
    act(() => vi.advanceTimersByTime(600));
    expect(trigger.getAttribute("aria-expanded")).toBe("false");

    fireEvent.touchStart(incoming, {
      touches: [{ clientX: 10, clientY: 10 }],
    });
    fireEvent.touchCancel(incoming, {
      changedTouches: [{ clientX: 10, clientY: 10 }],
    });
    act(() => vi.advanceTimersByTime(600));
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  }, 15_000);

  it("opens reply only for a qualifying incoming right swipe", async () => {
    const view = render(workspace());
    const incoming = bubble(view, "message-incoming");
    const own = bubble(view, "message-own");

    fireEvent.touchStart(incoming, {
      touches: [{ clientX: 10, clientY: 10 }],
    });
    fireEvent.touchMove(incoming, {
      touches: [{ clientX: 85, clientY: 15 }],
    });
    fireEvent.touchEnd(incoming);
    await waitFor(() =>
      expect(view.getByText("Replying to Other User")).toBeTruthy(),
    );
    expect(document.activeElement).toBe(view.getByLabelText("Message"));

    fireEvent.click(view.getByLabelText("Cancel reply"));
    fireEvent.touchStart(incoming, {
      touches: [{ clientX: 10, clientY: 10 }],
    });
    fireEvent.touchMove(incoming, {
      touches: [{ clientX: 60, clientY: 70 }],
    });
    fireEvent.touchEnd(incoming);
    expect(view.queryByText("Replying to Other User")).toBeNull();

    fireEvent.touchStart(own, {
      touches: [{ clientX: 10, clientY: 10 }],
    });
    fireEvent.touchMove(own, {
      touches: [{ clientX: 100, clientY: 10 }],
    });
    fireEvent.touchEnd(own);
    expect(view.queryByText(/Replying to Current User/)).toBeNull();
  });

  it("suppresses native context menus and preserves action eligibility", async () => {
    const view = render(workspace());
    const incoming = bubble(view, "message-incoming");
    const own = bubble(view, "message-own");
    const expired = bubble(view, "message-expired");

    const firstContext = new MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
    });
    act(() => incoming.dispatchEvent(firstContext));
    expect(firstContext.defaultPrevented).toBe(true);
    expect(within(incoming).getByRole("button", { name: "Reply" })).toBeTruthy();
    expect(
      (
        await view.findByRole("menuitem", { name: "Report" })
      ).getAttribute("href"),
    ).toBe(
      "/app/reports/new?targetType=MESSAGE&targetId=message-incoming&conversationId=conversation-1&messageId=message-incoming",
    );
    expect(within(incoming).queryByRole("button", { name: "Edit" })).toBeNull();

    const secondContext = new MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
    });
    act(() => incoming.dispatchEvent(secondContext));
    expect(secondContext.defaultPrevented).toBe(true);
    expect(
      within(incoming)
        .getByLabelText("Message actions")
        .getAttribute("aria-expanded"),
    ).toBe("true");

    expect(within(own).getByRole("button", { name: "Edit" })).toBeTruthy();
    expect(
      within(own).getByRole("button", { name: "Remove message" }),
    ).toBeTruthy();
    expect(within(own).queryByRole("link", { name: "Report" })).toBeNull();

    expect(within(expired).queryByRole("button", { name: "Edit" })).toBeNull();
    expect(
      within(expired).queryByRole("button", { name: "Remove message" }),
    ).toBeNull();
  });

  it("reports copy feedback, saves edits, and retains an audited tombstone", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    const view = render(workspace());
    const incoming = bubble(view, "message-incoming");
    const own = bubble(view, "message-own");

    fireEvent.click(within(incoming).getByLabelText("Copy"));
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith("Incoming action target"),
    );
    expect(view.getByText("Message copied")).toBeTruthy();

    fireEvent.click(within(own).getByLabelText("Edit"));
    const editDraft = view.getByLabelText("Edit message");
    fireEvent.change(editDraft, { target: { value: "Updated own message" } });
    fireEvent.click(view.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(mocks.editMessageAction).toHaveBeenCalledWith(
        "message-own",
        "Updated own message",
      ),
    );
    expect(view.getByText("Updated own message")).toBeTruthy();

    fireEvent.click(within(own).getByLabelText("Remove message"));
    const confirmation = await view.findByRole("dialog", {
      name: "Remove this message for everyone?",
    });
    fireEvent.click(
      within(confirmation).getByRole("button", { name: "Remove message" }),
    );
    await waitFor(() =>
      expect(mocks.deleteMessageAction).toHaveBeenCalledWith("message-own"),
    );
    expect(
      view.getByText("This message was removed from the chat view."),
    ).toBeTruthy();
  });

  it("surfaces clipboard and thrown mutation failures", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
    });
    mocks.deleteMessageAction.mockRejectedValue(new Error("offline"));
    const view = render(workspace());
    const incoming = bubble(view, "message-incoming");
    const own = bubble(view, "message-own");

    fireEvent.click(within(incoming).getByLabelText("Copy"));
    expect(await view.findByText("Could not copy message")).toBeTruthy();

    fireEvent.click(within(own).getByLabelText("Remove message"));
    const confirmation = await view.findByRole("dialog", {
      name: "Remove this message for everyone?",
    });
    fireEvent.click(
      within(confirmation).getByRole("button", { name: "Remove message" }),
    );
    expect(
      await view.findByText("Unable to remove this message. Please try again."),
    ).toBeTruthy();
  });
});
