// @vitest-environment jsdom

import {
  act,
  cleanup,
  fireEvent,
  render,
  waitFor,
  within,
} from "@testing-library/react";
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

  emitRaw(name: string, data: string) {
    this.listeners.get(name)?.({ data } as MessageEvent);
  }
}

describe("message workspace exact targets", () => {
  const scrollIntoView = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    window.history.replaceState(null, "", "/");
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
    await waitFor(() =>
      expect(scrollIntoView).toHaveBeenCalledWith({
        behavior: "smooth",
        block: "center",
      }),
    );
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
    await waitFor(() =>
      expect(mocks.sendMessageAction).toHaveBeenCalledTimes(2),
    );
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

  it("loads older history through the bounded cursor path", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({
        items: [
          {
            body: "Older loaded message",
            createdAt: "2026-07-01T10:00:00.000Z",
            id: "message-older",
            senderId: "user-2",
            senderName: "Other User",
          },
        ],
        nextCursor: null,
      }),
      ok: true,
    });
    vi.stubGlobal("fetch", fetchMock);

    const view = render(
      <MessageWorkspace
        conversations={[
          {
            id: "conversation-1",
            messages: [
              {
                body: "Latest loaded message",
                createdAt: "2026-07-31T10:00:00.000Z",
                id: "message-latest",
                senderId: "user-2",
                senderName: "Other User",
              },
            ],
            olderMessagesCursor: "opaque-cursor",
            participantName: "Other User",
          },
        ]}
        currentUserId="user-1"
      />,
    );

    fireEvent.click(view.getByRole("button", { name: "Load older messages" }));

    await waitFor(() => expect(view.getByText("Older loaded message")).toBeTruthy());
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/messages/history?conversationId=conversation-1&cursor=opaque-cursor",
      { cache: "no-store" },
    );
    expect(view.getByText("Latest loaded message")).toBeTruthy();
  });

  it("keeps the loaded history cursor stable across live snapshots", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({ items: [], nextCursor: null }),
      ok: true,
    });
    vi.stubGlobal("fetch", fetchMock);

    const view = render(
      <MessageWorkspace
        conversations={[
          {
            id: "conversation-1",
            messages: [
              {
                body: "Latest loaded message",
                createdAt: "2026-07-31T10:00:00.000Z",
                id: "message-latest",
                senderId: "user-2",
                senderName: "Other User",
              },
            ],
            olderMessagesCursor: "stable-history-cursor",
            participantName: "Other User",
          },
        ]}
        currentUserId="user-1"
      />,
    );

    await act(async () => {
      EventSourceMock.current?.emit("conversations", {
        conversations: [
          {
            id: "conversation-1",
            messages: [
              {
                body: "New live message",
                createdAt: "2026-07-31T11:00:00.000Z",
                id: "message-live",
                senderId: "user-2",
                senderName: "Other User",
              },
            ],
            olderMessagesCursor: "rewound-live-cursor",
            participantName: "Other User",
          },
        ],
      });
      await Promise.resolve();
    });

    fireEvent.click(view.getByRole("button", { name: "Load older messages" }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/messages/history?conversationId=conversation-1&cursor=stable-history-cursor",
        { cache: "no-store" },
      ),
    );
  });

  it("replaces a streamed message with its tombstone", async () => {
    const view = render(
      <MessageWorkspace
        conversations={[
          {
            id: "conversation-1",
            messages: [
              {
                body: "Message to remove",
                createdAt: "2026-07-31T10:00:00.000Z",
                id: "message-1",
                senderId: "user-2",
                senderName: "Other User",
              },
            ],
            participantName: "Other User",
          },
        ]}
        currentUserId="user-1"
      />,
    );

    await act(async () => {
      EventSourceMock.current?.emit("conversations", {
        conversations: [
          {
            id: "conversation-1",
            messages: [
              {
                body: "",
                createdAt: "2026-07-31T10:00:00.000Z",
                deletedAt: "2026-07-31T11:00:00.000Z",
                id: "message-1",
                senderId: "user-2",
                senderName: "Other User",
              },
            ],
            participantName: "Other User",
          },
        ],
      });
      await Promise.resolve();
    });

    expect(view.queryByText("Message to remove")).toBeNull();
    expect(
      view.getByText("This message was removed from the chat view."),
    ).toBeTruthy();
  });

  it("loads and deduplicates older conversations through the cursor endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({
        conversations: [
          {
            id: "conversation-older",
            messages: [],
            participantName: "Older User",
          },
        ],
        nextCursor: null,
      }),
      ok: true,
    });
    vi.stubGlobal("fetch", fetchMock);

    const view = render(
      <MessageWorkspace
        conversations={[
          {
            id: "conversation-1",
            messages: [],
            participantName: "Current User",
          },
        ]}
        currentUserId="user-1"
        olderConversationsCursor="older-conversations-cursor"
      />,
    );

    fireEvent.click(
      view.getByRole("button", { name: "Load older conversations" }),
    );

    await waitFor(() => expect(view.getByText("Older User")).toBeTruthy());
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/messages/conversations?cursor=older-conversations-cursor",
      { cache: "no-store" },
    );
    expect(
      view.queryByRole("button", { name: "Load older conversations" }),
    ).toBeNull();
  });

  it("marks list conversations read only after explicit activation", async () => {
    const view = render(
      <MessageWorkspace
        conversations={[
          {
            id: "conversation-1",
            messages: [],
            participantName: "Other User",
            unreadCount: 1,
          },
        ]}
        currentUserId="user-1"
      />,
    );

    await act(async () => Promise.resolve());
    expect(mocks.markConversationReadAction).not.toHaveBeenCalled();

    fireEvent.click(
      within(view.getByLabelText("Conversation list")).getByRole("button", {
        name: /Other User/,
      }),
    );
    await waitFor(() =>
      expect(mocks.markConversationReadAction).toHaveBeenCalledWith(
        "conversation-1",
      ),
    );
  });

  it("keeps persisted drafts scoped to the authenticated user", async () => {
    const conversation = {
      id: "conversation-shared",
      messages: [],
      participantName: "Shared participant",
    };
    const firstUser = render(
      <MessageWorkspace
        conversations={[conversation]}
        currentUserId="user-1"
      />,
    );
    fireEvent.change(firstUser.getByLabelText("Message"), {
      target: { value: "First user's private draft" },
    });
    expect(
      window.sessionStorage.getItem("perx:messages:user-1:drafts"),
    ).toContain("First user's private draft");
    firstUser.unmount();

    const secondUser = render(
      <MessageWorkspace
        conversations={[conversation]}
        currentUserId="user-2"
      />,
    );
    await act(async () => Promise.resolve());
    expect((secondUser.getByLabelText("Message") as HTMLTextAreaElement).value).toBe(
      "",
    );
  });

  it("ignores malformed streamed envelopes without replacing persisted messages", async () => {
    const view = render(
      <MessageWorkspace
        conversations={[
          {
            id: "conversation-1",
            messages: [
              {
                body: "Persisted message",
                createdAt: "2026-07-31T10:00:00.000Z",
                id: "message-1",
                senderId: "user-2",
                senderName: "Other User",
              },
            ],
            participantName: "Other User",
          },
        ]}
        currentUserId="user-1"
      />,
    );

    await act(async () => {
      expect(() =>
        EventSourceMock.current?.emitRaw("conversations", "not-json"),
      ).not.toThrow();
      EventSourceMock.current?.emitRaw("conversations", "null");
      EventSourceMock.current?.emit("conversations", {
        conversations: { id: "not-an-array" },
      });
      await Promise.resolve();
    });

    expect(view.getByText("Persisted message")).toBeTruthy();

    await act(async () => {
      EventSourceMock.current?.emit("conversations", {
        conversations: [
          {
            events: [
              {
                createdAt: "2026-07-31T11:00:00.000Z",
                id: "legacy-event",
                snapshot: null,
                type: "DEAL_CREATED",
              },
            ],
            id: "conversation-1",
            messages: [
              {
                body: "Valid streamed message",
                createdAt: "2026-07-31T11:00:00.000Z",
                id: "message-2",
                senderId: "user-2",
                senderName: "Other User",
              },
            ],
            participantName: "Other User",
          },
        ],
      });
      await Promise.resolve();
    });

    expect(view.getByText("Valid streamed message")).toBeTruthy();
    expect(
      view.container.querySelector('[data-event-id="legacy-event"]'),
    ).toBeNull();
  });

  it("preserves chat state while app navigation opens and closes", async () => {
    const view = render(
      <MessageWorkspace
        conversations={[
          {
            deal: {
              amountMinor: "25000000",
              currency: "NGN",
              id: "deal-1",
              status: "IN_PROGRESS",
              title: "Keyboard delivery",
              versionLabel: "v2",
            },
            dealHref: "/app/deals/deal-1",
            id: "conversation-1",
            messages: [
              {
                body: "Incoming message",
                createdAt: "2026-07-31T10:00:00.000Z",
                id: "message-other",
                senderId: "user-2",
                senderName: "Other User",
              },
              {
                body: "Editable message",
                createdAt: "2026-07-31T10:05:00.000Z",
                id: "message-own",
                senderId: "user-1",
                senderName: "Current User",
              },
            ],
            participantName: "Other User",
          },
        ]}
        currentUserId="user-1"
        userRoles={[]}
      />,
    );
    const workspace = view.getByLabelText("Message workspace");
    const list = view.getByLabelText("Conversation list");
    const listScroller = list.querySelector<HTMLElement>(
      '[data-conversation-list-scroll="true"]',
    );
    if (!listScroller) throw new Error("Conversation list scroller missing");
    listScroller.scrollTop = 48;

    fireEvent.click(within(list).getByRole("button", { name: /Other User/ }));
    expect(workspace.getAttribute("data-mobile-view")).toBe("conversation");
    await waitFor(() =>
      expect(document.activeElement).toBe(
        view.container.querySelector(".message-conversation-header"),
      ),
    );

    const composer = view.getByLabelText("Message") as HTMLTextAreaElement;
    fireEvent.change(composer, { target: { value: "Unsent draft" } });
    const history = view.getByLabelText("Message history");
    history.scrollTop = 96;

    const incomingBubble = view.container.querySelector(
      '[data-message-id="message-other"]',
    );
    if (!incomingBubble) throw new Error("Incoming message bubble missing");
    fireEvent.click(
      within(incomingBubble as HTMLElement).getByLabelText("Message actions"),
    );
    fireEvent.click(
      within(incomingBubble as HTMLElement).getByRole("button", {
        name: "Reply",
      }),
    );
    expect(view.getByText("Replying to Other User")).toBeTruthy();

    const showNavigation = view.getByRole("button", {
      name: "Show app navigation",
    });
    fireEvent.click(showNavigation);
    expect(view.getByRole("dialog", { name: "App navigation" })).toBeTruthy();
    expect(view.getByText("Go to Home")).toBeTruthy();
    expect(
      view.getByRole("link", { name: /Messages/ }).getAttribute("aria-current"),
    ).toBe("page");
    expect(composer.value).toBe("Unsent draft");
    expect(history.scrollTop).toBe(96);
    expect(view.getByText("Replying to Other User")).toBeTruthy();
    expect(view.getByText("Keyboard delivery")).toBeTruthy();

    fireEvent.click(view.getByRole("button", { name: "Hide app navigation" }));
    await waitFor(() => expect(document.activeElement).toBe(showNavigation));
    expect(composer.value).toBe("Unsent draft");
    expect(history.scrollTop).toBe(96);
    expect(view.getByText("Replying to Other User")).toBeTruthy();

    const ownBubble = view.container.querySelector(
      '[data-message-id="message-own"]',
    );
    if (!ownBubble) throw new Error("Current-user message bubble missing");
    fireEvent.click(
      within(ownBubble as HTMLElement).getByLabelText("Message actions"),
    );
    fireEvent.click(
      within(ownBubble as HTMLElement).getByRole("button", {
        name: "Edit",
      }),
    );
    const editDraft = view.getByLabelText(
      "Edit message",
    ) as HTMLTextAreaElement;
    expect(editDraft.value).toBe("Editable message");
    fireEvent.change(editDraft, { target: { value: "Unsaved edit remains" } });
    fireEvent.click(showNavigation);
    fireEvent.click(view.getByRole("button", { name: "Hide app navigation" }));
    expect(
      (view.getByLabelText("Edit message") as HTMLTextAreaElement).value,
    ).toBe("Unsaved edit remains");

    fireEvent.click(
      view.getByRole("button", { name: "Back to conversations" }),
    );
    expect(workspace.getAttribute("data-mobile-view")).toBe("list");
    expect(listScroller.scrollTop).toBe(48);
  }, 15_000);
});
