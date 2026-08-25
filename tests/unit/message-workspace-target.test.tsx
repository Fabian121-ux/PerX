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
  submitConversationProposalAction: vi.fn(),
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
vi.mock("@/features/proposals/actions", () => ({
  submitConversationProposalAction: mocks.submitConversationProposalAction,
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/app/messages/conversation-1",
}));

import { MessageWorkspace } from "@/components/messages/message-workspace";
import { FeedbackProvider } from "@/components/ui/feedback-provider";

function render(ui: ReactElement) {
  return testingLibraryRender(<FeedbackProvider>{ui}</FeedbackProvider>);
}

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

  emit(name: string, data: unknown, lastEventId = "") {
    this.listeners.get(name)?.({
      data: JSON.stringify(data),
      lastEventId,
    } as MessageEvent);
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
    mocks.submitConversationProposalAction.mockResolvedValue({
      event: {
        actorName: "Current User",
        createdAt: "2026-08-13T12:00:00.000Z",
        dealHref: null,
        id: "event-proposal-1",
        proposalHref: "/app/proposals/sent",
        proposalVersionId: "version-1",
        snapshot: {
          amountMinor: "25000000",
          currency: "NGN",
          description:
            "Deliver the complete scoped work with documented acceptance criteria.",
          versionNumber: 1,
        },
        type: "PROPOSAL_SUBMITTED",
      },
      success: true,
    });
    vi.stubGlobal("EventSource", EventSourceMock);
    Element.prototype.scrollIntoView = scrollIntoView;
    HTMLDivElement.prototype.scrollTo = vi.fn(function (
      this: HTMLDivElement,
      options?: ScrollToOptions | number,
      y?: number,
    ) {
      this.scrollTop =
        typeof options === "number"
          ? (y ?? 0)
          : (options?.top ?? this.scrollTop);
    });
    Object.defineProperties(HTMLDivElement.prototype, {
      clientHeight: { configurable: true, get: () => 200 },
      scrollHeight: { configurable: true, get: () => 1000 },
    });
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
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
        initialMutationCursor="server-render-cursor"
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
    expect(mocks.markConversationReadAction).not.toHaveBeenCalled();
    expect(EventSourceMock.current?.url).toBe(
      "/api/messages/events?conversationId=conversation-2&mutationCursor=server-render-cursor",
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
    fireEvent.keyDown(composer, { key: "Enter", shiftKey: true });
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

  it("renders and positions the immutable initial unread boundary", async () => {
    const view = render(
      <MessageWorkspace
        conversations={[
          {
            id: "conversation-1",
            initialUnreadMessageId: "message-unread",
            messages: [
              {
                body: "Previously read",
                createdAt: "2026-07-31T10:00:00.000Z",
                id: "message-read",
                readByCurrentUser: true,
                senderId: "user-2",
                senderName: "Other User",
              },
              {
                body: "First unread",
                createdAt: "2026-07-31T11:00:00.000Z",
                id: "message-unread",
                senderId: "user-2",
                senderName: "Other User",
              },
            ],
            participantName: "Other User",
          },
        ]}
        currentUserId="user-1"
        defaultConversationId="conversation-1"
      />,
    );

    expect(view.getByRole("separator", { name: "New messages" })).toBeTruthy();
    await waitFor(() =>
      expect(scrollIntoView).toHaveBeenCalledWith({
        behavior: "auto",
        block: "center",
      }),
    );

    await act(async () => {
      EventSourceMock.current?.emit("conversations", {
        conversations: [
          {
            id: "conversation-1",
            initialUnreadMessageId: null,
            messages: [],
            participantName: "Other User",
            unreadCount: 0,
          },
        ],
      });
      await Promise.resolve();
    });

    expect(view.getByRole("separator", { name: "New messages" })).toBeTruthy();
  });

  it("prioritizes an exact target over unread positioning", async () => {
    render(
      <MessageWorkspace
        conversations={[
          {
            id: "conversation-1",
            initialUnreadMessageId: "message-unread",
            messages: [
              {
                body: "First unread",
                createdAt: "2026-07-31T10:00:00.000Z",
                id: "message-unread",
                senderId: "user-2",
                senderName: "Other User",
              },
              {
                body: "Exact target",
                createdAt: "2026-07-31T11:00:00.000Z",
                id: "message-target",
                senderId: "user-2",
                senderName: "Other User",
              },
            ],
            participantName: "Other User",
          },
        ]}
        currentUserId="user-1"
        defaultConversationId="conversation-1"
        highlightMessageId="message-target"
      />,
    );

    await waitFor(() =>
      expect(scrollIntoView).toHaveBeenCalledWith({
        behavior: "smooth",
        block: "center",
      }),
    );
    expect(scrollIntoView).not.toHaveBeenCalledWith({
      behavior: "auto",
      block: "center",
    });
  });

  it("applies realtime inserts, updates, and deletes authoritatively", async () => {
    const view = render(
      <MessageWorkspace
        conversations={[
          {
            id: "conversation-1",
            lastMessage: "Original body",
            messages: [
              {
                body: "Original body",
                createdAt: "2026-07-31T10:00:00.000Z",
                id: "message-original",
                senderId: "user-2",
                senderName: "Other User",
              },
            ],
            participantName: "Other User",
            timestamp: "2026-07-31T10:00:00.000Z",
            unreadCount: 0,
          },
        ]}
        currentUserId="user-1"
        defaultConversationId="conversation-1"
      />,
    );

    await act(async () => {
      EventSourceMock.current?.emit("conversation-message", {
        conversationId: "conversation-1",
        message: {
          body: "Inserted body",
          createdAt: "2026-07-31T11:00:00.000Z",
          id: "message-live",
          readByCurrentUser: false,
          senderId: "user-2",
          senderName: "Other User",
        },
        messageId: "message-live",
        operation: "INSERT",
      });
      await Promise.resolve();
    });
    expect(view.getAllByText("Inserted body").length).toBeGreaterThan(0);

    await act(async () => {
      EventSourceMock.current?.emit("conversation-message", {
        conversationId: "conversation-1",
        message: {
          body: "Edited live body",
          createdAt: "2026-07-31T11:00:00.000Z",
          editedAt: "2026-07-31T11:01:00.000Z",
          id: "message-live",
          readByCurrentUser: false,
          senderId: "user-2",
          senderName: "Other User",
        },
        messageId: "message-live",
        operation: "UPDATE",
      });
      await Promise.resolve();
    });
    expect(view.queryByText("Inserted body")).toBeNull();
    expect(view.getAllByText("Edited live body").length).toBeGreaterThan(0);

    await act(async () => {
      EventSourceMock.current?.emit("conversation-message", {
        conversationId: "conversation-1",
        message: null,
        messageId: "message-live",
        operation: "DELETE",
      });
      await Promise.resolve();
    });
    expect(view.queryByText("Edited live body")).toBeNull();
    expect(view.getAllByText("Original body").length).toBeGreaterThan(0);
  });

  it("wraps long text, grows to a bounded height, and resets after send", async () => {
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
    let contentHeight = 44;
    Object.defineProperty(composer, "scrollHeight", {
      configurable: true,
      get: () => (composer.value ? contentHeight : 44),
    });

    expect(composer.tagName).toBe("TEXTAREA");
    expect(composer.wrap).toBe("soft");
    expect(composer.className).toContain("min-w-0");
    expect(composer.className).toContain("overflow-x-hidden");
    expect(composer.className).toContain("[overflow-wrap:anywhere]");

    const longUrl = `https://perx.test/${"unbroken".repeat(30)}`;
    contentHeight = 92;
    fireEvent.input(composer, {
      target: { value: `A long paragraph that wraps naturally ${longUrl}` },
    });
    expect(composer.style.height).toBe("92px");
    expect(composer.style.overflowY).toBe("hidden");

    contentHeight = 320;
    fireEvent.input(composer, {
      target: { value: `First\nSecond\nThird\nFourth\nFifth\n${longUrl}` },
    });
    expect(composer.style.height).toBe("144px");
    expect(composer.style.overflowY).toBe("auto");

    fireEvent.click(view.getByRole("button", { name: "Send message" }));
    await waitFor(() =>
      expect(mocks.sendMessageAction).toHaveBeenCalledWith(
        "conversation-1",
        `First\nSecond\nThird\nFourth\nFifth\n${longUrl}`,
        null,
      ),
    );
    await waitFor(() => expect(composer.value).toBe(""));
    expect(composer.style.height).toBe("44px");
    expect(composer.style.overflowY).toBe("hidden");
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

  it("opens one structured proposal flow from Make a Deal and exact @deal", async () => {
    const view = render(
      <MessageWorkspace
        conversations={[
          {
            dealOffer: {
              currency: "NGN",
              opportunityTitle: "Keyboard delivery",
            },
            id: "conversation-1",
            messages: [],
            participantName: "Other User",
          },
        ]}
        currentUserId="user-1"
      />,
    );

    fireEvent.click(view.getByRole("button", { name: "Make a Deal" }));
    expect(view.getByRole("dialog", { name: "Make a Deal" })).toBeTruthy();
    expect(
      view.getByText(/A Deal is created only if the other participant accepts/),
    ).toBeTruthy();
    expect(view.getByText(/Send locked terms to Other User/)).toBeTruthy();
    expect(
      view.getByText(
        /Payments are currently unavailable\. This Deal records agreed terms but does not hold funds\./,
      ),
    ).toBeTruthy();
    fireEvent.click(view.getByRole("button", { name: "Cancel" }));

    const composer = view.getByLabelText("Message");
    fireEvent.change(composer, { target: { value: " @DEAL " } });
    fireEvent.keyDown(composer, { ctrlKey: true, key: "Enter" });
    expect(view.getByRole("dialog", { name: "Make a Deal" })).toBeTruthy();
    expect(mocks.sendMessageAction).not.toHaveBeenCalled();

    fireEvent.change(view.getByLabelText("Agreement amount (NGN)"), {
      target: { value: "250000" },
    });
    fireEvent.change(view.getByLabelText("Proposal terms"), {
      target: {
        value:
          "Deliver the complete scoped work with documented acceptance criteria.",
      },
    });
    fireEvent.click(view.getByRole("button", { name: "Submit proposal" }));

    await waitFor(() =>
      expect(mocks.submitConversationProposalAction).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: "250000",
          conversationId: "conversation-1",
          deliveryDays: 14,
          revisions: 1,
        }),
      ),
    );
    await waitFor(() =>
      expect(view.getByText("Proposal version 1 submitted")).toBeTruthy(),
    );
    expect(
      view.getByRole("link", { name: "Review proposal" }).getAttribute("href"),
    ).toBe("/app/proposals/sent");
    expect(view.queryByRole("button", { name: "Make a Deal" })).toBeNull();
    expect((composer as HTMLTextAreaElement).value).toBe("");
  }, 15_000);

  it("preserves an unrelated draft after a proposal submitted from the visible control", async () => {
    const view = render(
      <MessageWorkspace
        conversations={[
          {
            dealOffer: {
              currency: "NGN",
              opportunityTitle: "Keyboard delivery",
            },
            id: "conversation-1",
            messages: [],
            participantName: "Other User",
          },
        ]}
        currentUserId="user-1"
      />,
    );
    const composer = view.getByLabelText("Message") as HTMLTextAreaElement;
    fireEvent.change(composer, { target: { value: "A separate chat draft" } });
    fireEvent.click(view.getByRole("button", { name: "Make a Deal" }));
    fireEvent.change(view.getByLabelText("Agreement amount (NGN)"), {
      target: { value: "250000" },
    });
    fireEvent.change(view.getByLabelText("Proposal terms"), {
      target: {
        value:
          "Deliver the complete scoped work with documented acceptance criteria.",
      },
    });
    fireEvent.click(view.getByRole("button", { name: "Submit proposal" }));

    await waitFor(() =>
      expect(view.getByText("Proposal submitted")).toBeTruthy(),
    );
    expect(composer.value).toBe("A separate chat draft");
  }, 15_000);

  it("keeps prose containing @deal as an ordinary message", async () => {
    const view = render(
      <MessageWorkspace
        conversations={[
          {
            dealOffer: {
              currency: "NGN",
              opportunityTitle: "Keyboard delivery",
            },
            id: "conversation-1",
            messages: [],
            participantName: "Other User",
          },
        ]}
        currentUserId="user-1"
      />,
    );
    const composer = view.getByLabelText("Message");
    fireEvent.change(composer, {
      target: { value: "Let's discuss @deal tomorrow" },
    });
    fireEvent.keyDown(composer, { ctrlKey: true, key: "Enter" });
    await waitFor(() =>
      expect(mocks.sendMessageAction).toHaveBeenCalledWith(
        "conversation-1",
        "Let's discuss @deal tomorrow",
        null,
      ),
    );
    expect(view.queryByRole("dialog", { name: "Make a Deal" })).toBeNull();
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

    await waitFor(() =>
      expect(view.getByText("Older loaded message")).toBeTruthy(),
    );
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

  it("applies an older-message mutation tombstone to bubbles and replies", async () => {
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
              {
                body: "Reply to old message",
                createdAt: "2026-07-31T10:05:00.000Z",
                id: "message-2",
                replyTo: {
                  body: "Message to remove",
                  id: "message-1",
                  senderId: "user-2",
                  senderName: "Other User",
                },
                senderId: "user-1",
                senderName: "Current User",
              },
            ],
            participantName: "Other User",
          },
        ]}
        currentUserId="user-1"
      />,
    );

    await act(async () => {
      EventSourceMock.current?.emit(
        "conversations",
        {
          conversations: [
            {
              id: "conversation-1",
              messages: [
                {
                  body: "Newest live message",
                  createdAt: "2026-07-31T11:00:00.000Z",
                  id: "message-new",
                  senderId: "user-2",
                  senderName: "Other User",
                },
              ],
              participantName: "Other User",
            },
          ],
          messageMutations: [
            {
              body: "",
              conversationId: "conversation-1",
              deletedAt: "2026-07-31T11:00:00.000Z",
              editedAt: null,
              id: "message-1",
            },
          ],
        },
        "mutation-cursor-1",
      );
      await Promise.resolve();
    });

    expect(view.queryByText("Message to remove")).toBeNull();
    expect(
      view.getByText("This message was removed from the chat view."),
    ).toBeTruthy();
    expect(view.getByText("Original message unavailable")).toBeTruthy();
    expect(view.getByText("Newest live message")).toBeTruthy();
  });

  it("merges a newly promoted conversation from the live list snapshot", async () => {
    const view = render(
      <MessageWorkspace
        conversations={[
          {
            id: "conversation-1",
            messages: [],
            participantName: "Existing User",
            timestamp: "2026-07-31T10:00:00.000Z",
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
            messages: [],
            participantName: "Existing User",
            timestamp: "2026-07-31T10:00:00.000Z",
          },
          {
            id: "conversation-promoted",
            messages: [],
            participantName: "Promoted User",
            timestamp: "2026-07-31T11:00:00.000Z",
          },
        ],
      });
      await Promise.resolve();
    });

    const rows = view.container.querySelectorAll(
      '[data-conversation-list-scroll="true"] > button',
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]?.textContent).toContain("Promoted User");
  });

  it("purges inactive conversations omitted from an authoritative live list", async () => {
    const view = render(
      <MessageWorkspace
        conversations={[
          {
            id: "conversation-1",
            messages: [],
            participantName: "Current User",
          },
          {
            id: "conversation-revoked",
            lastMessage: "Private summary",
            messages: [],
            participantName: "Revoked User",
          },
        ]}
        currentUserId="user-1"
      />,
    );

    await act(async () => {
      EventSourceMock.current?.emit("conversations", {
        conversationList: { ids: ["conversation-1"], nextCursor: null },
        conversations: [
          {
            id: "conversation-1",
            messages: [],
            participantName: "Current User",
          },
        ],
      });
      await Promise.resolve();
    });

    expect(view.queryByText("Revoked User")).toBeNull();
    expect(view.queryByText("Private summary")).toBeNull();
  });

  it("keeps an exact authorized active conversation outside a partial list", async () => {
    render(
      <MessageWorkspace
        conversations={[
          {
            id: "conversation-1",
            messages: [],
            participantName: "Current User",
          },
        ]}
        currentUserId="user-1"
      />,
    );
    expect(EventSourceMock.current?.url).toContain(
      "conversationId=conversation-1",
    );

    await act(async () => {
      EventSourceMock.current?.emit("conversations", {
        conversationList: {
          ids: ["conversation-newer"],
          nextCursor: "older-cursor",
        },
        conversations: [
          {
            id: "conversation-1",
            messages: [],
            participantName: "Current User",
          },
          {
            id: "conversation-newer",
            messages: [],
            participantName: "Newer User",
          },
        ],
      });
      await Promise.resolve();
    });

    expect(EventSourceMock.current?.url).toContain(
      "conversationId=conversation-1",
    );
  });

  it("reauthorizes loaded older conversations omitted from a bounded list", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({ ids: ["conversation-older"] }),
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
          {
            id: "conversation-older",
            messages: [],
            participantName: "Authorized Older User",
          },
        ]}
        currentUserId="user-1"
      />,
    );

    await act(async () => {
      EventSourceMock.current?.emit("conversations", {
        conversationList: {
          ids: ["conversation-1"],
          nextCursor: "older-cursor",
        },
        conversations: [
          {
            id: "conversation-1",
            messages: [],
            participantName: "Current User",
          },
        ],
      });
      await Promise.resolve();
    });

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/messages/authorization",
        expect.objectContaining({
          body: JSON.stringify({ conversationIds: ["conversation-older"] }),
          method: "POST",
        }),
      ),
    );
    expect(view.getByText("Authorized Older User")).toBeTruthy();
  });

  it("purges a loaded older conversation when exact reauthorization fails", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({ ids: [] }),
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
          {
            id: "conversation-revoked-older",
            lastMessage: "Revoked older summary",
            messages: [],
            participantName: "Revoked Older User",
          },
        ]}
        currentUserId="user-1"
      />,
    );

    await act(async () => {
      EventSourceMock.current?.emit("conversations", {
        conversationList: {
          ids: ["conversation-1"],
          nextCursor: "older-cursor",
        },
        conversations: [
          {
            id: "conversation-1",
            messages: [],
            participantName: "Current User",
          },
        ],
      });
      await Promise.resolve();
    });

    await waitFor(() =>
      expect(view.queryByText("Revoked Older User")).toBeNull(),
    );
    expect(view.queryByText("Revoked older summary")).toBeNull();
  });

  it("retains authorized older state for retry after a transient authorization error", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({ error: "Retry later." }),
      ok: false,
      status: 503,
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
          {
            id: "conversation-older",
            lastMessage: "Retained during retry",
            messages: [],
            participantName: "Older User",
          },
        ]}
        currentUserId="user-1"
      />,
    );

    await act(async () => {
      EventSourceMock.current?.emit("conversations", {
        conversationList: {
          ids: ["conversation-1"],
          nextCursor: "older-cursor",
        },
        conversations: [
          {
            id: "conversation-1",
            messages: [],
            participantName: "Current User",
          },
        ],
      });
      await Promise.resolve();
    });

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(view.getByText("Older User")).toBeTruthy();
    expect(view.getByText("Retained during retry")).toBeTruthy();
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
            messages: [
              {
                body: "Rendered unread message",
                createdAt: "2026-07-31T10:00:00.000Z",
                id: "message-rendered",
                senderId: "user-2",
                senderName: "Other User",
              },
            ],
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
        "message-rendered",
        "message",
      ),
    );
  });

  it("does not mark new messages read while history is scrolled up", async () => {
    const view = render(
      <MessageWorkspace
        conversations={[
          {
            id: "conversation-1",
            messages: [
              {
                body: "Rendered unread message",
                createdAt: "2026-07-31T10:00:00.000Z",
                id: "message-rendered",
                senderId: "user-2",
                senderName: "Other User",
              },
            ],
            participantName: "Other User",
            unreadCount: 1,
          },
        ]}
        currentUserId="user-1"
      />,
    );
    fireEvent.click(
      within(view.getByLabelText("Conversation list")).getByRole("button", {
        name: /Other User/,
      }),
    );
    await waitFor(() =>
      expect(mocks.markConversationReadAction).toHaveBeenCalledTimes(1),
    );
    mocks.markConversationReadAction.mockClear();

    const history = view.getByLabelText("Message history");
    Object.defineProperties(history, {
      clientHeight: { configurable: true, value: 200 },
      scrollHeight: { configurable: true, value: 1000 },
      scrollTop: { configurable: true, value: 100, writable: true },
    });
    fireEvent.pointerDown(history);
    fireEvent.scroll(history);
    await act(async () => {
      EventSourceMock.current?.emit("conversations", {
        conversations: [
          {
            id: "conversation-1",
            messages: [
              {
                body: "Unseen live message",
                createdAt: "2026-07-31T12:00:00.000Z",
                id: "message-unseen",
                senderId: "user-2",
                senderName: "Other User",
              },
            ],
            participantName: "Other User",
            unreadCount: 1,
          },
        ],
      });
      await Promise.resolve();
    });
    expect(mocks.markConversationReadAction).not.toHaveBeenCalled();

    history.scrollTop = 800;
    fireEvent.scroll(history);
    await waitFor(() =>
      expect(mocks.markConversationReadAction).toHaveBeenCalledWith(
        "conversation-1",
        "message-unseen",
        "message",
      ),
    );
  });

  it("stops marking read after the mobile conversation closes", async () => {
    const view = render(
      <MessageWorkspace
        conversations={[
          {
            id: "conversation-1",
            messages: [
              {
                body: "Rendered unread message",
                createdAt: "2026-07-31T10:00:00.000Z",
                id: "message-rendered",
                senderId: "user-2",
                senderName: "Other User",
              },
            ],
            participantName: "Other User",
            unreadCount: 1,
          },
        ]}
        currentUserId="user-1"
      />,
    );
    fireEvent.click(
      within(view.getByLabelText("Conversation list")).getByRole("button", {
        name: /Other User/,
      }),
    );
    await waitFor(() =>
      expect(mocks.markConversationReadAction).toHaveBeenCalledTimes(1),
    );
    fireEvent.click(
      view.getByRole("button", { name: "Back to conversations" }),
    );
    mocks.markConversationReadAction.mockClear();

    await act(async () => {
      EventSourceMock.current?.emit("conversations", {
        conversations: [
          {
            id: "conversation-1",
            messages: [
              {
                body: "Arrived while closed",
                createdAt: "2026-07-31T12:00:00.000Z",
                id: "message-closed",
                senderId: "user-2",
                senderName: "Other User",
              },
            ],
            participantName: "Other User",
            unreadCount: 1,
          },
        ],
      });
      await Promise.resolve();
    });
    expect(mocks.markConversationReadAction).not.toHaveBeenCalled();
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
    expect(
      (secondUser.getByLabelText("Message") as HTMLTextAreaElement).value,
    ).toBe("");
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

  it("purges loaded private messages when live authorization is revoked", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({
        conversations: [],
        messageMutations: [],
        mutationCursor: null,
      }),
      ok: true,
      status: 200,
    });
    vi.stubGlobal("fetch", fetchMock);
    const view = render(
      <MessageWorkspace
        conversations={[
          {
            id: "conversation-private",
            messages: [
              {
                body: "Private persisted message",
                createdAt: "2026-07-31T10:00:00.000Z",
                id: "message-private",
                senderId: "user-2",
                senderName: "Other User",
              },
            ],
            participantName: "Other User",
          },
        ]}
        currentUserId="user-1"
        defaultConversationId="conversation-private"
      />,
    );
    expect(view.getByText("Private persisted message")).toBeTruthy();

    await act(async () => {
      EventSourceMock.current?.emit("unavailable", {});
      await Promise.resolve();
    });

    await waitFor(() =>
      expect(view.queryByText("Private persisted message")).toBeNull(),
    );
    expect(view.getByText("No conversations yet")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith("/api/messages/sync", {
      cache: "no-store",
    });
  });

  it("stops fallback polling when the existing stream recovers", async () => {
    const intervalId = 42 as unknown as ReturnType<typeof window.setInterval>;
    const setIntervalSpy = vi
      .spyOn(window, "setInterval")
      .mockReturnValue(intervalId);
    const clearIntervalSpy = vi.spyOn(window, "clearInterval");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: async () => ({ conversations: [] }),
        ok: true,
        status: 200,
      }),
    );
    render(
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

    await act(async () => {
      EventSourceMock.current?.emit("stream-error", {});
      await Promise.resolve();
    });
    expect(setIntervalSpy).toHaveBeenCalled();

    await act(async () => {
      EventSourceMock.current?.emit("conversations", {
        conversations: [
          {
            id: "conversation-1",
            messages: [],
            participantName: "Other User",
          },
        ],
      });
      await Promise.resolve();
    });
    expect(clearIntervalSpy).toHaveBeenCalledWith(intervalId);
    setIntervalSpy.mockRestore();
    clearIntervalSpy.mockRestore();
  });

  it("restarts live sync without an expired mutation cursor", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 400 })
      .mockResolvedValueOnce({
        json: async () => ({
          conversations: [
            {
              id: "conversation-1",
              messages: [],
              participantName: "Other User",
            },
          ],
        }),
        ok: true,
        status: 200,
      });
    vi.stubGlobal("fetch", fetchMock);
    render(
      <MessageWorkspace
        conversations={[
          {
            id: "conversation-1",
            messages: [],
            participantName: "Other User",
          },
        ]}
        currentUserId="user-1"
        defaultConversationId="conversation-1"
        initialMutationCursor="expired-cursor"
      />,
    );
    const initialEventSource = EventSourceMock.current;

    await act(async () => {
      initialEventSource?.emit("stream-error", {});
      await Promise.resolve();
    });

    await waitFor(() =>
      expect(EventSourceMock.current).not.toBe(initialEventSource),
    );
    expect(EventSourceMock.current?.url).toBe(
      "/api/messages/events?conversationId=conversation-1",
    );
  });

  it("does not render cached history before reauthorizing an inactive conversation", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 404 });
    vi.stubGlobal("fetch", fetchMock);
    const view = render(
      <MessageWorkspace
        conversations={[
          {
            id: "conversation-1",
            messages: [],
            participantName: "Current User",
          },
          {
            historyLoaded: false,
            id: "conversation-private",
            messages: [
              {
                body: "Cached revoked history",
                createdAt: "2026-07-31T10:00:00.000Z",
                id: "message-private",
                senderId: "user-3",
                senderName: "Private User",
              },
            ],
            participantName: "Private User",
          },
        ]}
        currentUserId="user-1"
      />,
    );

    fireEvent.click(
      within(view.getByLabelText("Conversation list")).getByRole("button", {
        name: /Private User/,
      }),
    );

    await waitFor(() =>
      expect(
        within(view.getByLabelText("Conversation list")).queryByRole("button", {
          name: /Private User/,
        }),
      ).toBeNull(),
    );
    expect(view.queryByText("Cached revoked history")).toBeNull();
    expect(view.getAllByText("Current User").length).toBeGreaterThan(0);
  });

  it("reauthorizes browser-history conversation activation", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 404 });
    vi.stubGlobal("fetch", fetchMock);
    const view = render(
      <MessageWorkspace
        conversations={[
          {
            id: "conversation-1",
            messages: [],
            participantName: "Current User",
          },
          {
            id: "conversation-history",
            messages: [
              {
                body: "Revoked browser history",
                createdAt: "2026-07-31T10:00:00.000Z",
                id: "message-history",
                senderId: "user-3",
                senderName: "History User",
              },
            ],
            participantName: "History User",
          },
        ]}
        currentUserId="user-1"
      />,
    );

    await act(async () => {
      window.dispatchEvent(
        new PopStateEvent("popstate", {
          state: { perxMessagesConversationId: "conversation-history" },
        }),
      );
      await Promise.resolve();
    });

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/messages/sync?conversationId=conversation-history",
        { cache: "no-store" },
      ),
    );
    expect(view.queryByText("Revoked browser history")).toBeNull();
    expect(view.getAllByText("Current User").length).toBeGreaterThan(0);
  });

  it("restores a same-URL history conversation after a workspace remount", async () => {
    window.history.replaceState(
      { perxMessagesConversationId: "conversation-history" },
      "",
      "/app/messages",
    );
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({
        conversations: [
          {
            id: "conversation-history",
            messages: [
              {
                body: "Restored browser history",
                createdAt: "2026-07-31T10:00:00.000Z",
                id: "message-history",
                senderId: "user-3",
                senderName: "History User",
              },
            ],
            participantName: "History User",
          },
        ],
      }),
      ok: true,
      status: 200,
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
          {
            historyLoaded: false,
            id: "conversation-history",
            messages: [],
            participantName: "History User",
          },
        ]}
        currentUserId="user-1"
      />,
    );

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/messages/sync?conversationId=conversation-history",
        { cache: "no-store" },
      ),
    );
    await waitFor(() =>
      expect(
        view
          .getByLabelText("Message workspace")
          .getAttribute("data-mobile-view"),
      ).toBe("conversation"),
    );
    expect(view.getByText("Restored browser history")).toBeTruthy();
  });

  it("keeps the latest rapid conversation selection when responses arrive out of order", async () => {
    let resolveSecond:
      | ((response: {
          json: () => Promise<unknown>;
          ok: boolean;
          status: number;
        }) => void)
      | undefined;
    let resolveThird:
      | ((response: {
          json: () => Promise<unknown>;
          ok: boolean;
          status: number;
        }) => void)
      | undefined;
    const fetchMock = vi.fn((url: string) => {
      return new Promise<{
        json: () => Promise<unknown>;
        ok: boolean;
        status: number;
      }>((resolve) => {
        if (url.includes("conversation-2")) resolveSecond = resolve;
        if (url.includes("conversation-3")) resolveThird = resolve;
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    const view = render(
      <MessageWorkspace
        conversations={[
          { id: "conversation-1", messages: [], participantName: "First User" },
          {
            historyLoaded: false,
            id: "conversation-2",
            messages: [],
            participantName: "Second User",
          },
          {
            historyLoaded: false,
            id: "conversation-3",
            messages: [],
            participantName: "Third User",
          },
        ]}
        currentUserId="user-1"
      />,
    );
    const list = within(view.getByLabelText("Conversation list"));
    const secondButton = list.getByRole("button", { name: /Second User/ });
    const thirdButton = list.getByRole("button", { name: /Third User/ });

    fireEvent.click(secondButton);
    fireEvent.click(thirdButton);
    await act(async () => {
      resolveThird?.({
        json: async () => ({
          conversations: [
            {
              id: "conversation-3",
              messages: [
                {
                  body: "Latest selection",
                  createdAt: "2026-08-10T12:00:00.000Z",
                  id: "message-third",
                  senderId: "user-3",
                  senderName: "Third User",
                },
              ],
              participantName: "Third User",
            },
          ],
        }),
        ok: true,
        status: 200,
      });
      await Promise.resolve();
    });
    expect(
      within(view.getByLabelText("Active conversation")).getByText(
        "Latest selection",
      ),
    ).toBeTruthy();

    await act(async () => {
      resolveSecond?.({
        json: async () => ({
          conversations: [
            {
              id: "conversation-2",
              messages: [
                {
                  body: "Stale selection",
                  createdAt: "2026-08-10T12:01:00.000Z",
                  id: "message-second",
                  senderId: "user-2",
                  senderName: "Second User",
                },
              ],
              participantName: "Second User",
            },
          ],
        }),
        ok: true,
        status: 200,
      });
      await Promise.resolve();
    });
    expect(
      within(view.getByLabelText("Active conversation")).queryByText(
        "Stale selection",
      ),
    ).toBeNull();
    expect(
      within(view.getByLabelText("Active conversation")).getByText(
        "Latest selection",
      ),
    ).toBeTruthy();
  });

  it("counts all new inbound messages received while scrolled up", async () => {
    const view = render(
      <MessageWorkspace
        conversations={[
          {
            id: "conversation-1",
            messages: [
              {
                body: "Existing message",
                createdAt: "2026-08-10T10:00:00.000Z",
                id: "message-existing",
                senderId: "user-2",
                senderName: "Other User",
              },
            ],
            participantName: "Other User",
          },
        ]}
        currentUserId="user-1"
        defaultConversationId="conversation-1"
      />,
    );
    const history = view.getByLabelText("Message history");
    Object.defineProperties(history, {
      clientHeight: { configurable: true, value: 200 },
      scrollHeight: { configurable: true, value: 1000 },
      scrollTop: { configurable: true, value: 100, writable: true },
    });
    fireEvent.pointerDown(history);
    fireEvent.scroll(history);

    await act(async () => {
      EventSourceMock.current?.emit("conversations", {
        conversations: [
          {
            id: "conversation-1",
            messages: [
              {
                body: "First new message",
                createdAt: "2026-08-10T11:00:00.000Z",
                id: "message-new-1",
                senderId: "user-2",
                senderName: "Other User",
              },
              {
                body: "Second new message",
                createdAt: "2026-08-10T11:01:00.000Z",
                id: "message-new-2",
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

    expect(
      await view.findByRole("button", {
        name: "2 new messages. Jump to latest messages",
      }),
    ).toBeTruthy();
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
    fireEvent.pointerDown(history);
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
    showNavigation.focus();
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
