// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import {
  CHAT_DEAL_DRAFT_PREFIX,
  DEFAULT_CHAT_DEAL_DRAFT,
  chatDealDraftKey,
  clearChatDealDraft,
  hasChatDealDraft,
  parseChatDealDraft,
  readChatDealDraft,
  saveChatDealDraft,
} from "@/lib/messages/deal-draft";

beforeEach(() => sessionStorage.clear());

describe("private per-conversation Deal form drafts", () => {
  it("uses per-user and per-conversation tab-scoped storage", () => {
    const draft = {
      amount: "125000",
      deliveryDays: "21",
      revisions: "2",
      description: "Complete the agreed scope and acceptance tests.",
    };
    saveChatDealDraft("member-a", "conversation-1", draft);
    expect(sessionStorage.getItem(chatDealDraftKey("member-a", "conversation-1")))
      .toContain("125000");
    expect(chatDealDraftKey("member-a", "conversation-1"))
      .toContain(CHAT_DEAL_DRAFT_PREFIX);
    expect(readChatDealDraft("member-a", "conversation-1")).toEqual(draft);
    expect(readChatDealDraft("member-b", "conversation-1")).toEqual(DEFAULT_CHAT_DEAL_DRAFT);
    expect(readChatDealDraft("member-a", "conversation-2")).toEqual(DEFAULT_CHAT_DEAL_DRAFT);
    expect(hasChatDealDraft(draft)).toBe(true);
    clearChatDealDraft("member-a", "conversation-1");
    expect(readChatDealDraft("member-a", "conversation-1")).toEqual(DEFAULT_CHAT_DEAL_DRAFT);
  });

  it("handles malformed or oversized saved data without crashing or exposing it", () => {
    const key = chatDealDraftKey("member-a", "conversation-1");
    sessionStorage.setItem(key, "not valid json");
    expect(readChatDealDraft("member-a", "conversation-1")).toEqual(DEFAULT_CHAT_DEAL_DRAFT);
    sessionStorage.setItem(key, JSON.stringify({
      amount: "9".repeat(1000), deliveryDays: {}, revisions: null,
      description: "x".repeat(3000),
    }));
    expect(readChatDealDraft("member-a", "conversation-1")).toEqual(DEFAULT_CHAT_DEAL_DRAFT);
    expect(parseChatDealDraft(null)).toBeNull();
    expect(parseChatDealDraft([])).toBeNull();
    expect(hasChatDealDraft(DEFAULT_CHAT_DEAL_DRAFT)).toBe(false);
  });
});
