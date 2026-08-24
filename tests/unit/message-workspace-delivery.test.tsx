// @vitest-environment jsdom

import {
  act,
  cleanup,
  fireEvent,
  render as testingLibraryRender,
  waitFor,
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
  usePathname: () => "/app/messages",
}));

import { MessageWorkspace } from "@/components/messages/message-workspace";
import { FeedbackProvider } from "@/components/ui/feedback-provider";

function render(ui: ReactElement) {
  return testingLibraryRender(<FeedbackProvider>{ui}</FeedbackProvider>);
}

class EventSourceMock {
  static current: EventSourceMock | null = null;
  static instances: EventSourceMock[] = [];
  static readonly CLOSED = 2;

  readonly listeners = new Map<string, (event: MessageEvent) => void>();
  closed = false;
  onerror: (() => void) | null = null;
  readyState = 1;
  readonly url: string;

  constructor(url: string) {
    this.url = url;
    EventSourceMock.current = this;
    EventSourceMock.instances.push(this);
  }

  addEventListener(name: string, listener: (event: MessageEvent) => void) {
    this.listeners.set(name, listener);
  }

  close() {
    this.closed = true;
  }

  emit(name: string, data: unknown, lastEventId = "") {
    this.listeners.get(name)?.({
      data: JSON.stringify(data),
      lastEventId,
    } as MessageEvent);
  }
}

function setVisibility(state: "hidden" | "visible") {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value: state,
  });
  document.dispatchEvent(new Event("visibilitychange"));
}

const otherUserMessage = {
  body: "Latest loaded message",
  createdAt: "2026-07-31T10:00:00.000Z",
  id: "message-latest",
  senderId: "user-2",
  senderName: "Other User",
};

describe("message workspace delivery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    window.history.replaceState(null, "", "/");
    EventSourceMock.current = null;
    EventSourceMock.instances = [];
    mocks.markConversationReadAction.mockResolvedValue({ success: true });
    mocks.sendMessageAction.mockResolvedValue({ success: true });
    vi.stubGlobal("EventSource", EventSourceMock);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      json: async () => ({ conversations: [] }),
      ok: true,
    }));
    Element.prototype.scrollIntoView = vi.fn();
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
    setVisibility("visible");
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  describe("older history reachability", () => {
    it("keeps a server cursor delivered by a full-history snapshot", async () => {
      const view = render(
        <MessageWorkspace
          conversations={[
            {
              id: "conversation-1",
              messages: [otherUserMessage],
              participantName: "Other User",
            },
          ]}
          currentUserId="user-1"
        />,
      );

      expect(view.queryByRole("button", { name: "Load older messages" })).toBe(
        null,
      );

      await act(async () => {
        EventSourceMock.current?.emit("conversations", {
          conversations: [
            {
              historyLoaded: true,
              id: "conversation-1",
              messages: [otherUserMessage],
              olderMessagesCursor: "server-history-cursor",
              participantName: "Other User",
            },
          ],
        });
        await Promise.resolve();
      });

      await waitFor(() =>
        expect(
          view.getByRole("button", { name: "Load older messages" }),
        ).toBeTruthy(),
      );
    });

    /**
     * The sequence a user hits by opening a second conversation from the list.
     *
     * A conversation arrives with no cursor, a list-only snapshot reports null
     * for it, and only then does a full-history snapshot deliver the real
     * cursor. If the null were treated as a client-held value the real cursor
     * would be discarded and older messages would be permanently unreachable.
     */
    it("accepts a cursor that arrives after a list-only snapshot reported null", async () => {
      const view = render(
        <MessageWorkspace
          conversations={[
            {
              id: "conversation-1",
              messages: [otherUserMessage],
              participantName: "Other User",
            },
          ]}
          currentUserId="user-1"
        />,
      );

      // List-only snapshot: one message per conversation, cursor reported null.
      await act(async () => {
        EventSourceMock.current?.emit("conversations", {
          conversations: [
            {
              historyLoaded: false,
              id: "conversation-1",
              messages: [otherUserMessage],
              olderMessagesCursor: null,
              participantName: "Other User",
            },
          ],
        });
        await Promise.resolve();
      });

      expect(view.queryByRole("button", { name: "Load older messages" })).toBe(
        null,
      );

      // Opening the conversation loads full history and the real cursor.
      await act(async () => {
        EventSourceMock.current?.emit("conversations", {
          conversations: [
            {
              historyLoaded: true,
              id: "conversation-1",
              messages: [otherUserMessage],
              olderMessagesCursor: "real-history-cursor",
              participantName: "Other User",
            },
          ],
        });
        await Promise.resolve();
      });

      await waitFor(() =>
        expect(
          view.getByRole("button", { name: "Load older messages" }),
        ).toBeTruthy(),
      );
    });

    /**
     * A list-only snapshot loads one message per conversation and always
     * reports a null cursor. Treating that as authoritative would hide the
     * control permanently for every conversation the user had not opened.
     */
    it("ignores the null cursor of a list-only snapshot", async () => {
      const view = render(
        <MessageWorkspace
          conversations={[
            {
              historyLoaded: true,
              id: "conversation-1",
              messages: [otherUserMessage],
              olderMessagesCursor: "server-history-cursor",
              participantName: "Other User",
            },
          ]}
          currentUserId="user-1"
        />,
      );

      expect(
        view.getByRole("button", { name: "Load older messages" }),
      ).toBeTruthy();

      await act(async () => {
        EventSourceMock.current?.emit("conversations", {
          conversations: [
            {
              historyLoaded: false,
              id: "conversation-1",
              messages: [otherUserMessage],
              olderMessagesCursor: null,
              participantName: "Other User",
            },
          ],
        });
        await Promise.resolve();
      });

      expect(
        view.getByRole("button", { name: "Load older messages" }),
      ).toBeTruthy();
    });
  });

  describe("optimistic delivery", () => {
    it("keeps the sent message visible until the snapshot carries it", async () => {
      let resolveSend: (value: { messageId: string; success: true }) => void =
        () => {};
      mocks.sendMessageAction.mockReturnValue(
        new Promise<{ messageId: string; success: true }>((resolve) => {
          resolveSend = resolve;
        }),
      );

      const view = render(
        <MessageWorkspace
          conversations={[
            {
              id: "conversation-1",
              messages: [otherUserMessage],
              participantName: "Other User",
            },
          ]}
          currentUserId="user-1"
        />,
      );

      const composer = view.getByLabelText("Message");
      fireEvent.change(composer, { target: { value: "Sent from the client" } });
      fireEvent.submit(composer.closest("form")!);

      expect(view.getByText("Sent from the client")).toBeTruthy();

      // The action has resolved but no snapshot has delivered the message yet.
      await act(async () => {
        resolveSend({ messageId: "message-real", success: true });
        await Promise.resolve();
      });

      expect(view.getByText("Sent from the client")).toBeTruthy();

      // The snapshot now carries it; exactly one copy must remain.
      await act(async () => {
        EventSourceMock.current?.emit("conversations", {
          conversations: [
            {
              historyLoaded: true,
              id: "conversation-1",
              messages: [
                otherUserMessage,
                {
                  body: "Sent from the client",
                  createdAt: "2026-07-31T10:05:00.000Z",
                  id: "message-real",
                  senderId: "user-1",
                  senderName: "Current User",
                },
              ],
              participantName: "Other User",
            },
          ],
        });
        await Promise.resolve();
      });

      await waitFor(() =>
        expect(view.getAllByText("Sent from the client")).toHaveLength(1),
      );
    });

    it("retains a failed message and resends it on retry", async () => {
      mocks.sendMessageAction.mockResolvedValueOnce({
        error: "Failed to send message.",
      });

      const view = render(
        <MessageWorkspace
          conversations={[
            {
              id: "conversation-1",
              messages: [otherUserMessage],
              participantName: "Other User",
            },
          ]}
          currentUserId="user-1"
        />,
      );

      const composer = view.getByLabelText("Message");
      fireEvent.change(composer, { target: { value: "Message that fails" } });
      await act(async () => {
        fireEvent.submit(composer.closest("form")!);
        await Promise.resolve();
      });

      // The body is preserved in place rather than silently discarded.
      await waitFor(() =>
        expect(view.getByRole("button", { name: "Retry" })).toBeTruthy(),
      );
      expect(view.getByText("Message that fails")).toBeTruthy();

      mocks.sendMessageAction.mockResolvedValueOnce({
        messageId: "message-real",
        success: true,
      });

      await act(async () => {
        fireEvent.click(view.getByRole("button", { name: "Retry" }));
        await Promise.resolve();
      });

      expect(mocks.sendMessageAction).toHaveBeenCalledTimes(2);
      expect(mocks.sendMessageAction).toHaveBeenLastCalledWith(
        "conversation-1",
        "Message that fails",
        null,
      );
      // Still exactly one bubble - the retry reuses it rather than appending.
      await waitFor(() =>
        expect(view.getAllByText("Message that fails")).toHaveLength(1),
      );
      expect(view.queryByRole("button", { name: "Retry" })).toBe(null);
    });

    it("discards a failed message on request", async () => {
      mocks.sendMessageAction.mockResolvedValueOnce({
        error: "Failed to send message.",
      });

      const view = render(
        <MessageWorkspace
          conversations={[
            {
              id: "conversation-1",
              messages: [otherUserMessage],
              participantName: "Other User",
            },
          ]}
          currentUserId="user-1"
        />,
      );

      const composer = view.getByLabelText("Message");
      fireEvent.change(composer, { target: { value: "Discard me" } });
      await act(async () => {
        fireEvent.submit(composer.closest("form")!);
        await Promise.resolve();
      });

      await waitFor(() =>
        expect(view.getByRole("button", { name: "Discard" })).toBeTruthy(),
      );

      await act(async () => {
        fireEvent.click(view.getByRole("button", { name: "Discard" }));
        await Promise.resolve();
      });

      expect(view.queryByText("Discard me")).toBe(null);
    });

    /**
     * Two sends in the same millisecond must not collide on one React key,
     * which a bare timestamp id would allow.
     */
    it("gives sends issued in the same tick distinct identities", async () => {
      const sent: string[] = [];
      mocks.sendMessageAction.mockImplementation(
        async (_conversationId: string, body: string) => {
          sent.push(body);
          return { messageId: `message-${sent.length}`, success: true };
        },
      );

      const view = render(
        <MessageWorkspace
          conversations={[
            {
              id: "conversation-1",
              messages: [otherUserMessage],
              participantName: "Other User",
            },
          ]}
          currentUserId="user-1"
        />,
      );

      const composer = view.getByLabelText("Message");

      await act(async () => {
        fireEvent.change(composer, { target: { value: "First" } });
        fireEvent.submit(composer.closest("form")!);
        await Promise.resolve();
      });
      await act(async () => {
        fireEvent.change(composer, { target: { value: "Second" } });
        fireEvent.submit(composer.closest("form")!);
        await Promise.resolve();
      });

      expect(sent).toEqual(["First", "Second"]);
      expect(view.getAllByText("First")).toHaveLength(1);
      expect(view.getAllByText("Second")).toHaveLength(1);
    });
  });

  describe("stream lifecycle", () => {
    it("closes the stream while the tab is hidden and reopens on return", async () => {
      render(
        <MessageWorkspace
          conversations={[
            {
              id: "conversation-1",
              messages: [otherUserMessage],
              participantName: "Other User",
            },
          ]}
          currentUserId="user-1"
        />,
      );

      const initial = EventSourceMock.current;
      expect(initial).not.toBe(null);
      expect(initial?.closed).toBe(false);
      const openedWhileVisible = EventSourceMock.instances.length;

      await act(async () => {
        setVisibility("hidden");
        await Promise.resolve();
      });

      // A hidden tab costs a server snapshot every two seconds for updates
      // nobody can see, so the connection is released.
      await waitFor(() => expect(initial?.closed).toBe(true));
      expect(EventSourceMock.instances).toHaveLength(openedWhileVisible);

      await act(async () => {
        setVisibility("visible");
        await Promise.resolve();
      });

      await waitFor(() =>
        expect(EventSourceMock.instances.length).toBe(openedWhileVisible + 1),
      );
      expect(EventSourceMock.current?.closed).toBe(false);
    });

    /**
     * A mutation cursor older than the server retention window is rejected
     * with 400, which closes an EventSource permanently. Replaying it would
     * fail identically, so it must be dropped before reconnecting.
     */
    it("drops a rejected mutation cursor before reconnecting", async () => {
      render(
        <MessageWorkspace
          conversations={[
            {
              id: "conversation-1",
              messages: [otherUserMessage],
              participantName: "Other User",
            },
          ]}
          currentUserId="user-1"
          defaultConversationId="conversation-1"
          initialMutationCursor="stale-cursor"
        />,
      );

      const initial = EventSourceMock.current;
      expect(initial?.url).toContain("mutationCursor=stale-cursor");

      await act(async () => {
        initial!.readyState = EventSourceMock.CLOSED;
        initial!.onerror?.();
        await Promise.resolve();
      });

      await waitFor(() =>
        expect(EventSourceMock.instances.length).toBeGreaterThan(1),
      );
      expect(EventSourceMock.current?.url).not.toContain("stale-cursor");
    });
  });
});
