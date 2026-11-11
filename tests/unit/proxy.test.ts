import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

import { proxy } from "@/proxy";

describe("application proxy security boundary", async () => {
  it("adds security headers to public requests", async () => {
    const response = await proxy(new NextRequest("http://localhost/discover"));

    expect(response.status).toBe(200);
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("x-frame-options")).toBe("DENY");
    expect(response.headers.get("referrer-policy")).toBe(
      "strict-origin-when-cross-origin",
    );
    expect(response.headers.get("permissions-policy")).toContain("camera=()");
  });

  it("redirects an unauthenticated protected page without revealing data", async () => {
    const response = await proxy(
      new NextRequest("http://localhost/app/messages"),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain(
      "/sign-in?next=%2Fapp%2Fmessages",
    );
  });

  it("allows a protected request through the proxy when a session cookie exists", async () => {
    const response = await proxy(
      new NextRequest("http://localhost/app/messages", {
        headers: { cookie: "ptahx_session=test-token" },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("x-frame-options")).toBe("DENY");
  });
});
