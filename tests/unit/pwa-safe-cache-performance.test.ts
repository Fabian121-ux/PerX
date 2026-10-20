import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

const swSource = readFileSync(join(process.cwd(), "public/sw.js"), "utf8");

type StubRequest = {
  method: string;
  mode: string;
  url: string;
  destination: string;
  headers: Headers;
};
type StubFetchEvent = {
  request: StubRequest;
  respondWith: (result: Promise<Response>) => void;
  waitUntil: (promise: Promise<unknown>) => void;
};
function setup(fetcher: (request: StubRequest) => Promise<Response>) {
  const listeners = new Map<string, (event: StubFetchEvent) => void>();
  const entries = new Map<string, Map<string, Response>>();
  const removed: string[] = [];
  const cachesStub = {
    open: async (name: string) => {
      if (!entries.has(name)) entries.set(name, new Map());
      const data = entries.get(name)!;
      return {
        match: async (request: StubRequest) => data.get(request.url),
        put: async (request: StubRequest, response: Response) => {
          data.set(request.url, response);
        },
        keys: async () => [...data.keys()].map((url) => ({ url })),
        delete: async (request: { url: string }) => data.delete(request.url),
        add: async (url: string) => { data.set(url, new Response("ok")); },
      };
    },
    keys: async () => [...entries.keys()],
    delete: async (name: string) => {
      removed.push(name);
      return entries.delete(name);
    },
    match: async (url: string) => url === "/offline"
      ? new Response("<h1>PtahX is not connected</h1>", { headers: { "Content-Type": "text/html" } })
      : undefined,
  };
  const worker = {
    location: { origin: "https://ptahx.com" },
    addEventListener: (event: string, handler: (e: StubFetchEvent) => void) => listeners.set(event, handler),
    clients: { claim: async () => undefined },
    skipWaiting: vi.fn(),
  };
  runInNewContext(swSource, {
    self: worker,
    caches: cachesStub,
    fetch: fetcher,
    Response,
    URL,
  });

  async function dispatch(path: string, options: Partial<StubRequest> = {}) {
    const waits: Promise<unknown>[] = [];
    let response: Promise<Response> | undefined;
    const request: StubRequest = {
      method: "GET", mode: "cors",
      url: `https://ptahx.com${path}`, destination: "script",
      headers: new Headers(),
      ...options,
    };
    listeners.get("fetch")!({
      request,
      respondWith: (p) => { response = p; },
      waitUntil: (p) => { waits.push(p); },
    });
    const result = response ? await response : undefined;
    await Promise.all(waits);
    return result;
  }
  return { dispatch, entries, listeners, removed, cachesStub };
}

describe("PtahX privacy-safe offline caching", () => {
  it("never caches API, RSC, private images, external domains or POST requests", async () => {
    const fetcher = vi.fn(async () => new Response("private"));
    const env = setup(fetcher);
    expect(await env.dispatch("/api/messages")).toBeUndefined();
    expect(await env.dispatch("/_next/image?url=%2Favatar.jpeg")).toBeUndefined();
    expect(await env.dispatch("/app/messages", { mode: "cors", headers: new Headers({ RSC: "1" }) })).toBeUndefined();
    expect(await env.dispatch("/app/deals/secret")).toBeUndefined();
    expect(await env.dispatch("/api/presence/heartbeat", { method: "POST" })).toBeUndefined();
    expect(await env.dispatch("/brand/logo.svg", { url: "https://other-site.test/brand/logo.svg" })).toBeUndefined();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("serves a generic offline page, not cached user-specific chat or deals HTML", async () => {
    const fetcher = vi.fn(async () => { throw new Error("network offline"); });
    const env = setup(fetcher);
    const response = await env.dispatch("/app/messages/a-private-conversation", {
      mode: "navigate", destination: "document",
    });
    expect(await response?.text()).toContain("PtahX is not connected");
    expect(env.entries.size).toBe(0);
  });

  it("caches immutable public JS only if the response is not private or HTML", async () => {
    const response = new Response("console.log('ok')", {
      headers: { "Content-Type": "application/javascript", "Cache-Control": "public,max-age=31536000" },
    });
    Object.defineProperty(response, "type", { value: "basic" });
    const fetcher = vi.fn(async () => response);
    const env = setup(fetcher);
    const result = await env.dispatch("/_next/static/chunks/main.js");
    expect(await result?.text()).toContain("console.log");
    expect([...env.entries.values()][0].size).toBe(1);
    await env.dispatch("/_next/static/chunks/main.js");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("does not cache HTML returned under an asset URL (prevents stale MIME errors)", async () => {
    const response = new Response("<html>sign in</html>", {
      headers: { "Content-Type": "text/html" },
    });
    Object.defineProperty(response, "type", { value: "basic" });
    const env = setup(async () => response);
    await env.dispatch("/_next/static/chunks/unauthorized.js");
    expect([...env.entries.values()][0].size).toBe(0);
  });

  it("keeps private no-store data out of public asset cache even if misrouted", async () => {
    const response = new Response("secret", {
      headers: { "Content-Type": "application/javascript", "Cache-Control": "private,no-store" },
    });
    Object.defineProperty(response, "type", { value: "basic" });
    const env = setup(async () => response);
    await env.dispatch("/brand/secret.js");
    expect([...env.entries.values()][0].size).toBe(0);
  });

  it("does not permit unbounded image cache growth", () => {
    expect(swSource).toContain("PUBLIC_MAX_ENTRIES = 48");
    expect(swSource).toContain("BUILD_MAX_ENTRIES = 180");
    expect(swSource).toContain("trimCache");
    expect(swSource).toContain("url.pathname.startsWith(\"/_next/image\")");
  });
});

describe("free-tier-friendly UI polling and local diagnostics", () => {
  const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
  it("stops expensive unread-count polling when hidden or offline", () => {
    const shell = source("src/components/layout/app-shell.tsx");
    expect(shell).toContain("document.visibilityState !== \"visible\"");
    expect(shell).toContain("!navigator.onLine");
    expect(shell).toContain("60_000");
    expect(shell).toContain("connection?.saveData");
  });
  it("never stores private unread-count responses in a shared cache", () => {
    expect(source("src/app/api/unread-counts/route.ts")).toContain('Cache-Control": "private, no-store"');
  });
  it("records optional web vitals locally without sending account data to Supabase", () => {
    const vitals = source("src/components/performance/performance-vitals.tsx");
    expect(vitals).toContain("useReportWebVitals");
    expect(vitals).toContain("sessionStorage");
    expect(vitals).not.toContain("fetch(");
    expect(vitals).not.toContain("sendBeacon");
  });
  it("does not prefetch a database route for every feed listing in view", () => {
    expect(source("src/components/feed/feed-post-card.tsx")).toContain("prefetch={false}");
    expect(source("src/components/social/social-post-card.tsx")).toContain("prefetch={false}");
  });
});
