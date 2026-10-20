/**
 * Client-only, tab-scoped drafts for chat Deal terms. Proposal submissions
 * always require fresh server authorization; browser drafts are never sent
 * without the member explicitly pressing Submit.
 */
export type ChatDealDraft = {
  amount: string;
  deliveryDays: string;
  revisions: string;
  description: string;
};

export const DEFAULT_CHAT_DEAL_DRAFT: ChatDealDraft = {
  amount: "",
  deliveryDays: "14",
  revisions: "1",
  description: "",
};

export const CHAT_DEAL_DRAFT_PREFIX = "ptahx:chat-deal-draft:v1";

export function chatDealDraftKey(userId: string, conversationId: string): string {
  // Both identifiers are server-issued and this key is used solely in
  // sessionStorage; no persisted data is shared between accounts.
  return `${CHAT_DEAL_DRAFT_PREFIX}:${userId}:${conversationId}`;
}

function safeText(value: unknown, maxLength: number, fallback: string) {
  return typeof value === "string" && value.length <= maxLength
    ? value
    : fallback;
}

export function parseChatDealDraft(value: unknown): ChatDealDraft | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const data = value as Record<string, unknown>;
  return {
    amount: safeText(data.amount, 24, ""),
    deliveryDays: safeText(data.deliveryDays, 3, "14"),
    revisions: safeText(data.revisions, 2, "1"),
    description: safeText(data.description, 2000, ""),
  };
}

export function readChatDealDraft(userId: string, conversationId: string): ChatDealDraft {
  if (typeof window === "undefined") return { ...DEFAULT_CHAT_DEAL_DRAFT };
  try {
    const saved = window.sessionStorage.getItem(chatDealDraftKey(userId, conversationId));
    return saved ? parseChatDealDraft(JSON.parse(saved)) ?? { ...DEFAULT_CHAT_DEAL_DRAFT }
      : { ...DEFAULT_CHAT_DEAL_DRAFT };
  } catch {
    return { ...DEFAULT_CHAT_DEAL_DRAFT };
  }
}

export function saveChatDealDraft(
  userId: string,
  conversationId: string,
  draft: ChatDealDraft,
) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      chatDealDraftKey(userId, conversationId),
      JSON.stringify(draft),
    );
  } catch {
    // Storage quotas or private browsing must not prevent proposal drafting.
  }
}

export function clearChatDealDraft(userId: string, conversationId: string) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(chatDealDraftKey(userId, conversationId));
  } catch {
    // The user can continue using the form when storage is unavailable.
  }
}

export function hasChatDealDraft(draft: ChatDealDraft) {
  return Boolean(
    draft.amount.trim() ||
    draft.description.trim() ||
    draft.deliveryDays !== "14" ||
    draft.revisions !== "1",
  );
}
