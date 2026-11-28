import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ destroySession: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ destroySession: mocks.destroySession }));

import { GET, POST } from "@/app/api/auth/clear-session/route";

const url = "https://ptahx.test/api/auth/clear-session";

function post(origin?: string) {
  return new NextRequest(url, {
    method: "POST",
    headers: origin ? { origin } : {},
    body: new URLSearchParams({ next: "/app/messages" }),
  });
}

describe("session cleanup (PXR-014)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("keeps GET non-mutating and preserves a local return path", async () => {
    const response = await GET(new NextRequest(url + "?next=/app/messages"));
    expect(response.status).toBe(303);
    expect(new URL(response.headers.get("location")!).searchParams.get("returnTo")).toBe("/app/messages");
    expect(mocks.destroySession).not.toHaveBeenCalled();
  });

  it.each(["https://other.test", "null", undefined])("rejects untrusted origin %s", async (origin) => {
    const response = await POST(post(origin));
    expect(response.status).toBe(403);
    expect(mocks.destroySession).not.toHaveBeenCalled();
  });

  it("clears a session only through same-origin POST and redirects with GET", async () => {
    const response = await POST(post("https://ptahx.test"));
    expect(response.status).toBe(303);
    expect(mocks.destroySession).toHaveBeenCalledTimes(1);
    expect(new URL(response.headers.get("location")!).searchParams.get("returnTo")).toBe("/app/messages");
  });

  it("keeps untrusted return destinations on the application", async () => {
    const response = await GET(new NextRequest(url + "?next=https://other.test"));
    const target = new URL(response.headers.get("location")!);
    expect(target.origin).toBe("https://ptahx.test");
    expect(target.searchParams.get("returnTo")).toBe("/app");
  });
});
