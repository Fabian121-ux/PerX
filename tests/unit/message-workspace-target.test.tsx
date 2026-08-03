// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
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

import { MessageWorkspace } from "@/components/messages/message-workspace";

class EventSourceMock {
  static current: EventSourceMock | null = null;

  readonly listeners = new Map<string, (event: MessageEvent) => void>();
  onerror: (() => void) | null = null;
  readonly url: string;

  constructor(url: string) {
    this.url = url;
    EventSourceMock.current = this;
  }

  addEventListener(name: string, listener: (event: MessageEvent) => void) {
    this.listeners.set(name, listener);
  }
  close() {}

  emit(name: string, data: unknown) {
    this.listeners.get(name)?.({ data: JSON.stringify(data) } as MessageEvent);
  }
}

describe("message workspace exact targets", () => {
  const scrollIntoView = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    EventSourceMock.current = null;
    mocks.markConversationReadAction.mockResolvedValue({ success: true });
    mocks.sendMessageAction.mockResolvedValue({ success: true });
    vi.stubGlobal("EventSource", EventSourceMock);
    Element.prototype.scrollIntoView = scrollIntoView;
    HTMLDivElement.prototype.scrollTo = vi.fn();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("opens the routed conversation and scrolls to and highlights its exact message", async () => {
    const view = render(
      <MessageWorkspace
        conversations={[
          {
            id: "conversation-1",
            messages: [
              {
                body: "Other conversation",
                createdAt: "2026-07-31T10:00:00.000Z",
                id: "message-1",
                senderId: "user-3",
                senderName: "Other User",
              },
            ],
            participantName: "Other User",
          },
          {
            id: "conversation-2",
            messages: [
              {
                body: "Exact target body",
                createdAt: "2026-07-31T11:00:00.000Z",
                id: "message-target",
                senderId: "user-2",
                senderName: "Target User",
              },
            ],
            participantName: "Target User",
            unreadCount: 1,
          },
        ]}
        currentUserId="user-1"
        defaultConversationId="conversation-2"
        highlightMessageId="message-target"
      />,
    );

    const target = view.container.querySelector(
      '[data-message-id="message-target"]',
    );
    expect(target?.getAttribute("aria-current")).toBe("true");
    await waitFor(() => expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "center",
    }));
    await waitFor(() =>
      expect(mocks.markConversationReadAction).toHaveBeenCalledWith(
        "conversation-2",
      ),
    );
    expect(EventSourceMock.current?.url).toBe(
      "/api/messages/events?conversationId=conversation-2",
    );

    await act(async () => {
      EventSourceMock.current?.emit("conversations", {
        conversations: [
          {
            id: "conversation-2",
            messages: [
              {
                body: "New streamed message",
                createdAt: "2026-07-31T12:00:00.000Z",
                id: "message-new",
                senderId: "user-2",
                senderName: "Target User",
              },
            ],
            participantName: "Target User",
          },
        ],
      });
      await Promise.resolve();
    });

    expect(
      view.container.querySelector('[data-message-id="message-target"]'),
    ).not.toBeNull();
    expect(view.getByText("Other User")).toBeTruthy();
    expect(view.getAllByText("Target User").length).toBeGreaterThan(0);
  });

  it("keeps Enter multiline and sends only with Ctrl or Command Enter outside IME composition", async () => {
    const view = render(
      <MessageWorkspace
        conversations={[
          {
            id: "conversation-1",
            messages: [],
            participantName: "Other User",
          },
        ]}
        currentUserId="user-1"
      />,
    );
    const composer = view.getByLabelText("Message") as HTMLTextAreaElement;

    fireEvent.change(composer, { target: { value: "First line" } });
    fireEvent.keyDown(composer, { key: "Enter" });
    expect(mocks.sendMessageAction).not.toHaveBeenCalled();

    fireEvent.compositionStart(composer);
    fireEvent.keyDown(composer, { ctrlKey: true, key: "Enter" });
    fireEvent.compositionEnd(composer);
    expect(mocks.sendMessageAction).not.toHaveBeenCalled();

    fireEvent.keyDown(composer, { ctrlKey: true, key: "Enter", keyCode: 229 });
    expect(mocks.sendMessageAction).not.toHaveBeenCalled();

    fireEvent.keyDown(composer, { ctrlKey: true, key: "Enter" });
    await waitFor(() =>
      expect(mocks.sendMessageAction).toHaveBeenCalledWith(
        "conversation-1",
        "First line",
        null,
      ),
    );

    fireEvent.change(composer, { target: { value: "Second message" } });
    fireEvent.keyDown(composer, { key: "Enter", metaKey: true });
    await waitFor(() => expect(mocks.sendMessageAction).toHaveBeenCalledTimes(2));
  });

  it("renders and highlights structured immutable Deal events", async () => {
    const view = render(
      <MessageWorkspace
        conversations={[
          {
            events: [
              {
                actorName: "Other User",
                createdAt: "2026-07-31T11:00:00.000Z",
                dealHref: "/app/deals/deal-1",
                id: "event-1",
                snapshot: {
                  amountMinor: "25000000",
                  currency: "NGN",
                  onlinePaymentActive: false,
                  versionNumber: 2,
                },
                type: "DEAL_CREATED",
              },
            ],
            id: "conversation-1",
            messages: [],
            participantName: "Other User",
          },
        ]}
        currentUserId="user-1"
        highlightEventId="event-1"
      />,
    );

    const target = view.container.querySelector('[data-event-id="event-1"]');
    expect(target?.getAttribute("aria-current")).toBe("true");
    expect(view.getByText("Deal record created")).toBeTruthy();
    expect(view.getByText("Open Deal")).toBeTruthy();
    await waitFor(() => expect(scrollIntoView).toHaveBeenCalled());
  });
});
