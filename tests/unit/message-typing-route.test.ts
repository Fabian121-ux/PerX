import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getServerEnv: vi.fn(),
  hasConversationRealtimeAccess: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getCurrentUser: mocks.getCurrentUser,
}));
vi.mock("@/lib/env", () => ({
  getServerEnv: mocks.getServerEnv,
}));
vi.mock("@/lib/messages/realtime", () => ({
  hasConversationRealtimeAccess: mocks.hasConversationRealtimeAccess,
}));

import { POST } from "@/app/api/messages/typing/route";

describe("message typing route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentUser.mockResolvedValue({
      id: "user-1",
      name: "Current User",
      username: "current-user",
    });
    mocks.getServerEnv.mockReturnValue({
      NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "server-secret",
    });
    mocks.hasConversationRealtimeAccess.mockResolvedValue(true);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
  });

  it("requires authentication and does not reveal conversation access", async () => {
    mocks.getCurrentUser.mockResolvedValue(null);
    const response = await POST(
      new Request("http://localhost/api/messages/typing", {
        body: JSON.stringify({ conversationId: "conversation-1", isTyping: true }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      }),
    );
    expect(response.status).toBe(401);
    expect(mocks.hasConversationRealtimeAccess).not.toHaveBeenCalled();
  });

  it("validates the payload before checking conversation access", async () => {
    const response = await POST(
      new Request("http://localhost/api/messages/typing", {
        body: JSON.stringify({ conversationId: "not-a-cuid", isTyping: true }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      }),
    );
    expect(response.status).toBe(400);
    expect(mocks.hasConversationRealtimeAccess).not.toHaveBeenCalled();
  });

  it("only broadcasts authenticated typing state to an accessible private topic", async () => {
    const fetchMock = vi.mocked(fetch);
    const response = await POST(
      new Request("http://localhost/api/messages/typing", {
        body: JSON.stringify({ conversationId: "clx1234567890123456789012", isTyping: true }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.hasConversationRealtimeAccess).toHaveBeenCalledWith(
      "clx1234567890123456789012",
      "user-1",
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "https://project.supabase.co/realtime/v1/api/broadcast?private=true",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          apikey: "server-secret",
          Authorization: "Bearer server-secret",
        }),
        body: JSON.stringify({
          messages: [
            {
              topic: "conversation:clx1234567890123456789012:typing",
              event: "typing",
              payload: {
                conversationId: "clx1234567890123456789012",
                isTyping: true,
                name: "Current User",
                userId: "user-1",
              },
            },
          ],
        }),
      }),
    );
  });

  it("does not broadcast to conversations the current user cannot access", async () => {
    mocks.hasConversationRealtimeAccess.mockResolvedValue(false);
    const response = await POST(
      new Request("http://localhost/api/messages/typing", {
        body: JSON.stringify({ conversationId: "clx1234567890123456789012", isTyping: true }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      }),
    );
    expect(response.status).toBe(404);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns a service-unavailable response when broadcast delivery fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    const response = await POST(
      new Request("http://localhost/api/messages/typing", {
        body: JSON.stringify({ conversationId: "clx1234567890123456789012", isTyping: false }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      }),
    );
    expect(response.status).toBe(503);
  });
});
