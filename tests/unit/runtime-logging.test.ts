import { afterEach, describe, expect, it, vi } from "vitest";

import { logServerDataError } from "@/lib/logging/runtime";

describe("server runtime diagnostics", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("logs correlation fields without raw record IDs, emails, or credentials", () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const error = Object.assign(
      new Error(
        "Failed for private.user@example.com at postgresql://user:password@db.example.test/perx",
      ),
      { code: "P2022", digest: "server-digest" },
    );

    logServerDataError({
      error,
      operation: "load-conversations",
      recordId: "conversation-private-id",
      requestId: "iad1::request-123 invalid content",
      route: "/app/messages/[conversationId]",
    });

    expect(consoleError).toHaveBeenCalledTimes(1);
    const [, payload] = consoleError.mock.calls[0]!;
    const serialized = JSON.stringify(payload);
    expect(serialized).toContain("P2022");
    expect(serialized).toContain("server-digest");
    expect(serialized).toContain("iad1::request-123invalidcontent");
    expect(serialized).not.toContain("conversation-private-id");
    expect(serialized).not.toContain("private.user@example.com");
    expect(serialized).not.toContain("password");
  });
});
