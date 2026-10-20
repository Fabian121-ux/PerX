"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

import { SocialPostCard } from "@/components/social/social-post-card";
import type { SocialPostView } from "@/lib/social/contracts";

/** Infinite public/community feed without synthetic or duplicated posts. */
export function SocialFeedStream({
  initialItems,
  initialNextCursor,
  moreHref = "/posts",
  viewerId,
}: {
  initialItems: SocialPostView[];
  initialNextCursor: string | null;
  moreHref?: string;
  viewerId?: string;
}) {
  const [items, setItems] = useState(initialItems);
  const [cursor, setCursor] = useState(initialNextCursor);
  const [blockedAuthors, setBlockedAuthors] = useState<ReadonlySet<string>>(() => new Set());
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "end">(
    initialNextCursor ? "idle" : "end",
  );
  const sentinel = useRef<HTMLDivElement | null>(null);
  const inFlight = useRef(false);
  const cursorRef = useRef(cursor);
  const cancel = useRef<AbortController | null>(null);
  useEffect(() => { cursorRef.current = cursor; }, [cursor]);

  const loadMore = useCallback(async () => {
    if (inFlight.current || !cursorRef.current) return;
    inFlight.current = true;
    cancel.current?.abort();
    const controller = new AbortController();
    cancel.current = controller;
    setStatus("loading");
    try {
      const response = await fetch(`/api/social-feed?cursor=${encodeURIComponent(cursorRef.current)}`, {
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok) throw new Error("Feed temporarily unavailable");
      const data = (await response.json()) as { items?: SocialPostView[]; nextCursor?: string | null };
      if (!Array.isArray(data.items)) throw new Error("Invalid response");
      const next = typeof data.nextCursor === "string" ? data.nextCursor : null;
      // Merge by stable server IDs; never pretend the same posts are new.
      setItems((current) => {
        const seen = new Set(current.map((post) => post.id));
        return [...current, ...data.items!.filter((post) => !seen.has(post.id) && seen.add(post.id))];
      });
      cursorRef.current = next;
      setCursor(next);
      setStatus(next ? "idle" : "end");
    } catch {
      if (!controller.signal.aborted) setStatus("error");
    } finally {
      inFlight.current = false;
    }
  }, []);

  useEffect(() => {
    const node = sentinel.current;
    if (!node || !cursor || status !== "idle" || typeof IntersectionObserver === "undefined") return;
    const root = document.querySelector<HTMLElement>(".dashboard-main");
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) void loadMore();
    }, { root: root || null, rootMargin: "500px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, [cursor, loadMore, status]);
  useEffect(() => () => cancel.current?.abort(), []);

  return (
    <>
      {items.filter((post) => !blockedAuthors.has(post.author.id)).map((post) => (
        <SocialPostCard
          key={post.id}
          post={post}
          viewerId={viewerId}
          onBlocked={(authorId) =>
            setBlockedAuthors((current) => new Set([...current, authorId]))
          }
        />
      ))}
      <div aria-hidden className="h-1" ref={sentinel} />
      {status === "loading" ? (
        <p aria-live="polite" className="rounded-2xl border border-[color:var(--px-border)] bg-[color:var(--px-surface)] p-5 text-center text-sm font-semibold text-[color:var(--px-text-muted)]">Loading more updates…</p>
      ) : null}
      {status === "error" ? (
        <div className="rounded-2xl border border-[color:var(--px-border)] bg-[color:var(--px-surface)] p-4 text-center" role="alert">
          <p className="text-sm font-semibold text-[color:var(--px-text)]">Couldn&apos;t load more posts. Your posts above are still here.</p>
          <button className="mt-3 min-h-11 rounded-xl bg-[color:var(--px-primary)] px-5 text-sm font-bold text-white" onClick={() => { setStatus("idle"); void loadMore(); }} type="button">Try again</button>
        </div>
      ) : null}
      {status === "end" && items.length ? (
        <p className="py-3 text-center text-sm font-medium text-[color:var(--px-text-muted)]">You&apos;re up to date with community posts.</p>
      ) : null}
      {status === "idle" && cursor ? (
        <Link href={moreHref} className="mx-auto inline-flex min-h-11 items-center justify-center rounded-xl border border-[color:var(--px-border-strong)] px-5 text-sm font-bold text-[color:var(--px-primary-ink)]">
          Browse community updates
        </Link>
      ) : null}
    </>
  );
}
