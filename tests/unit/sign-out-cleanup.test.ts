// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";

import {
  clearAuthenticatedClientState,
  isSigningOut,
  markAuthenticatedSessionActive,
} from "@/lib/auth/client-session-cleanup";
import { readFeedCache, writeFeedCache } from "@/lib/feed/feed-cache";

describe("sign-out client state cleanup", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    window.localStorage.clear();
    markAuthenticatedSessionActive();
  });

  it("purges authenticated caches from both brand generations on shared devices", () => {
    const keys = [
      "perx:home-feed:v1",
      "perx:messages:user-1:drafts",
      "perx:opportunity-composer:v1:user-1:SERVICE",
      "ptahx:home-feed:v1",
      "ptahx:messages:user-1:drafts",
      "ptahx:opportunity-composer:v1:user-1:SERVICE",
    ];
    for (const storage of [window.localStorage, window.sessionStorage]) {
      for (const key of keys) storage.setItem(key, "private");
      storage.setItem("theme", "dark");
    }

    clearAuthenticatedClientState();

    for (const storage of [window.localStorage, window.sessionStorage]) {
      for (const key of keys) expect(storage.getItem(key)).toBeNull();
      expect(storage.getItem("theme")).toBe("dark");
    }
  });

  it("removes the cached home feed so it cannot bleed into the next account", () => {
    window.sessionStorage.setItem("ptahx:home-feed:v1", '{"items":[]}');

    clearAuthenticatedClientState();

    expect(window.sessionStorage.getItem("ptahx:home-feed:v1")).toBeNull();
  });

  it("removes per-user message drafts, filters, and scroll state", () => {
    for (const key of [
      "ptahx:messages:user-1:drafts",
      "ptahx:messages:user-1:filter",
      "ptahx:messages:user-1:list-scroll",
      "ptahx:messages:user-1:query",
    ]) {
      window.sessionStorage.setItem(key, "private");
      window.localStorage.setItem(key, "private");
    }

    clearAuthenticatedClientState();

    for (const key of [
      "ptahx:messages:user-1:drafts",
      "ptahx:messages:user-1:filter",
      "ptahx:messages:user-1:list-scroll",
      "ptahx:messages:user-1:query",
    ]) {
      expect(window.sessionStorage.getItem(key)).toBeNull();
      expect(window.localStorage.getItem(key)).toBeNull();
    }
  });

  it("removes opportunity composer drafts", () => {
    window.localStorage.setItem(
      "ptahx:opportunity-composer:v1:user-1:SERVICE",
      "draft body",
    );

    clearAuthenticatedClientState();

    expect(
      window.localStorage.getItem(
        "ptahx:opportunity-composer:v1:user-1:SERVICE",
      ),
    ).toBeNull();
  });

  it("clears every user's cached keys, not only the active one", () => {
    window.sessionStorage.setItem("ptahx:messages:user-1:drafts", "a");
    window.sessionStorage.setItem("ptahx:messages:user-2:drafts", "b");

    clearAuthenticatedClientState();

    expect(window.sessionStorage.length).toBe(0);
  });

  it("leaves device preferences that are not account data alone", () => {
    window.localStorage.setItem("theme", "dark");
    window.localStorage.setItem("ptahx:sponsored-dismissed", "[1]");

    clearAuthenticatedClientState();

    // Wiping the theme would be a surprising side effect of signing out.
    expect(window.localStorage.getItem("theme")).toBe("dark");
    expect(window.localStorage.getItem("ptahx:sponsored-dismissed")).toBe("[1]");
  });

  it("stops the feed cache being rewritten after sign-out purges it", () => {
    const entry = {
      nextCursor: "cursor-1",
      nextSegment: null,
      posts: [{ id: "post-1", title: "Cached post" }],
      scrollTop: 240,
      userId: "user-1",
    } as unknown as Parameters<typeof writeFeedCache>[0];

    writeFeedCache(entry);
    expect(readFeedCache("user-1")).not.toBeNull();

    clearAuthenticatedClientState();

    // The home feed persists its snapshot on unmount, which happens *after*
    // sign-out clears storage as the router leaves the page. Without the guard
    // this rewrite would hand the next account the previous user's feed.
    writeFeedCache(entry);

    expect(readFeedCache("user-1")).toBeNull();
  });

  it("resumes caching once a new session mounts an authenticated surface", () => {
    clearAuthenticatedClientState();
    expect(isSigningOut()).toBe(true);

    // Sign-out routes to /sign-in client-side, so the module is never
    // re-evaluated; without this the flag would disable scroll restore for the
    // rest of the tab's life.
    markAuthenticatedSessionActive();
    expect(isSigningOut()).toBe(false);

    writeFeedCache({
      nextCursor: "cursor-2",
      nextSegment: null,
      posts: [{ id: "post-2", title: "Fresh post" }],
      scrollTop: 0,
      userId: "user-2",
    } as unknown as Parameters<typeof writeFeedCache>[0]);

    expect(readFeedCache("user-2")).not.toBeNull();
  });
});
