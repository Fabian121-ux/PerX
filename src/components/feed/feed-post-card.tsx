"use client";

import { Clock, MapPin, ShieldCheck } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef } from "react";

import { FeedSaveButton } from "@/components/dashboard/feed-save-button";
import { Avatar } from "@/components/ui/avatar";
import type { HomeFeedPost } from "@/lib/data/home-feed-view";
import { getCanonicalOpportunityPath } from "@/lib/data/opportunity-path";
import { recordFeedEvent } from "@/lib/feed/events";
import { formatBudgetRange } from "@/lib/money";
import { trustBadgeClassName } from "@/lib/trust/engine";

/**
 * Posts above this index are assumed to be within the first viewport and are
 * loaded eagerly with fetch priority. Everything after is lazy, so a long feed
 * does not download media the viewer may never scroll to.
 */
const ABOVE_THE_FOLD_COUNT = 2;

export function FeedPostCard({
  onVisible,
  position,
  post,
}: {
  onVisible?: (post: HomeFeedPost, position: number) => void;
  position: number;
  post: HomeFeedPost;
}) {
  const detailHref = getCanonicalOpportunityPath(post.slug);
  const authorHref = post.authorUsername ? `/u/${post.authorUsername}` : null;
  const articleRef = useRef<HTMLElement | null>(null);
  const priority = position < ABOVE_THE_FOLD_COUNT;

  /**
   * Impression signal for Batch 8 ranking.
   *
   * Requires half the card to be visible so a post flicked past at speed is not
   * counted as seen. The observer disconnects after the first hit: an
   * impression is recorded once per post, and leaving it attached would run a
   * callback on every scroll for every card in a long feed.
   */
  useEffect(() => {
    if (!onVisible) return;
    const node = articleRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          onVisible(post, position);
          observer.disconnect();
        }
      },
      { threshold: 0.5 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [onVisible, position, post]);

  return (
    <article
      className="overflow-hidden rounded-[22px] border border-[color:var(--px-border)] bg-[color:var(--px-surface)] shadow-sm"
      data-post-id={post.id}
      ref={articleRef}
    >
      <header className="flex items-start justify-between gap-3 px-4 pb-3 pt-4 sm:px-5 sm:pt-5">
        <div className="flex min-w-0 items-center gap-3">
          {/*
            Every feed avatar is lazy. Only the composer avatar above it is
            eager, so a long scroll never fetches avatars the viewer has not
            reached.
          */}
          <Avatar
            className="ring-1 ring-[color:var(--px-border)]"
            name={post.authorName}
            size={44}
            src={post.authorAvatarUrl}
          />
          <div className="min-w-0">
            {authorHref ? (
              <Link
                className="block truncate text-sm font-black text-[color:var(--px-text)] hover:text-[color:var(--px-primary)] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)]"
                href={authorHref}
                onClick={() =>
                  recordFeedEvent({ name: "profile_open", position, postId: post.id })
                }
              >
                {post.authorName}
              </Link>
            ) : (
              <p className="truncate text-sm font-black text-[color:var(--px-text)]">
                {post.authorName}
              </p>
            )}
            <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-[color:var(--px-text-muted)]">
              <PostedTime value={post.publishedAt} />
              <span aria-hidden>·</span>
              <span>{post.type.replaceAll("_", " ")}</span>
            </p>
          </div>
        </div>
        <span
          aria-label={`${post.trust.shortLabel} trust level. ${post.trust.description}`}
          className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-black ${trustBadgeClassName(
            post.trust.level,
          )}`}
        >
          {post.trust.shortLabel}
        </span>
      </header>

      <div className="px-4 pb-4 sm:px-5">
        <Link
          className="group block rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)]"
          href={detailHref}
          onClick={() =>
            recordFeedEvent({ name: "post_open", position, postId: post.id })
          }
        >
          <h3 className="text-lg font-black leading-7 text-[color:var(--px-text)] transition group-hover:text-[color:var(--px-primary)] sm:text-xl">
            {post.title}
          </h3>
          {/*
            `break-words` matters on narrow viewports: an unbroken URL or token
            in a summary is the usual cause of horizontal overflow at 320px.
          */}
          <p className="mt-2 whitespace-pre-line break-words text-sm leading-6 text-[color:var(--px-text-muted)]">
            {post.summary}
          </p>
        </Link>
      </div>

      {post.imageUrl ? (
        <Link
          aria-label={`Open ${post.title}`}
          /*
            The aspect ratio is declared on the container so the browser
            reserves the exact box before the image arrives. Without it every
            image load would shift the posts below it.
          */
          className="relative block aspect-[16/8] w-full overflow-hidden bg-[color:var(--px-muted)] focus:outline-none focus-visible:ring-inset focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)]"
          href={detailHref}
          onClick={() =>
            recordFeedEvent({ name: "post_open", position, postId: post.id })
          }
        >
          <Image
            alt={post.imageAlt}
            className="object-cover transition duration-300 hover:scale-[1.015] motion-reduce:transform-none"
            fill
            loading={priority ? "eager" : "lazy"}
            priority={priority}
            /*
              The feed column is capped at 640px on desktop, so requesting a
              full-width source on a wide screen would download several times
              the pixels actually displayed.
            */
            sizes="(max-width: 640px) 100vw, 640px"
            src={post.imageUrl}
          />
        </Link>
      ) : (
        <PostGraphic title={post.title} type={post.type} />
      )}

      <div className="grid gap-3 px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-[color:var(--px-text-muted)]">
            <span className="inline-flex items-center gap-1.5">
              <MapPin aria-hidden size={14} />
              {post.remote
                ? "Remote supported"
                : (post.location ?? "Location not specified")}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock aria-hidden size={14} />
              <PostedTime value={post.publishedAt} />
            </span>
          </div>
          <span className="font-black text-[color:var(--px-primary)]">
            {formatBudgetRange(
              post.budgetMinMinor,
              post.budgetMaxMinor,
              post.currency,
            )}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-[color:var(--px-border)] pt-3">
          <FeedSaveButton
            initialSaved={post.viewerHasSaved}
            opportunityId={post.id}
          />
          <Link
            className="inline-flex min-h-11 items-center rounded-xl bg-[color:var(--px-primary)] px-4 text-sm font-bold text-white transition hover:bg-[color:var(--px-primary-strong)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)]"
            href={detailHref}
            onClick={() =>
              recordFeedEvent({ name: "post_open", position, postId: post.id })
            }
          >
            View post
          </Link>
        </div>
      </div>
    </article>
  );
}

/**
 * Relative time, rendered from an ISO string.
 *
 * `dateTime` carries the machine-readable value so assistive technology and
 * crawlers get the exact timestamp rather than the rounded label.
 */
function PostedTime({ value }: { value: string | null }) {
  if (!value) return <span>recently</span>;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return <span>recently</span>;

  return <time dateTime={value}>{formatTimeAgo(date)}</time>;
}

export function formatTimeAgo(date: Date, now = new Date()) {
  const diffMs = now.getTime() - date.getTime();
  // A small negative skew between server and client clocks is normal.
  if (diffMs < 0) return "just now";

  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;

  return `${Math.floor(days / 30)}mo ago`;
}

function PostGraphic({ title, type }: { title: string; type: string }) {
  const offset = (title.length + type.length) % 28;
  return (
    <div
      aria-hidden
      className="relative h-36 w-full overflow-hidden bg-[linear-gradient(135deg,#061936_0%,#123466_55%,#5b46f2_100%)]"
    >
      <div className="absolute -right-8 -top-10 h-32 w-32 rounded-full bg-white/20 blur-2xl" />
      <div className="absolute bottom-5 left-5 h-12 w-12 rounded-full border border-white/40" />
      <div
        className="absolute inset-x-0 bottom-0 h-24 opacity-35"
        style={{
          backgroundImage:
            "linear-gradient(90deg, rgba(255,255,255,.28) 1px, transparent 1px), linear-gradient(0deg, rgba(255,255,255,.18) 1px, transparent 1px)",
          backgroundPosition: `${offset}px 0`,
          backgroundSize: "18px 18px",
        }}
      />
      <ShieldCheck className="absolute bottom-5 right-5 text-white" size={24} />
    </div>
  );
}
