"use client";
import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/avatar";
import { ShareButton } from "@/components/feed/share-button";
import { SocialAuthorActions } from "@/components/social/social-author-actions";
import { HandHeart, Lightbulb, MessageCircle, PartyPopper, ThumbsUp } from "lucide-react";
import { setPostReactionAction } from "@/features/social/actions";
import {
  reactionKinds,
  reactionLabels,
  socialPostPath,
  socialSignInPath,
  type ReactionKind,
  type SocialPostView,
} from "@/lib/social/contracts";

const reactionIcons = {
  LIKE: ThumbsUp,
  CELEBRATE: PartyPopper,
  SUPPORT: HandHeart,
  INSIGHTFUL: Lightbulb,
} satisfies Record<ReactionKind, typeof ThumbsUp>;

function ReactionIcon({ kind }: { kind: ReactionKind }) {
  const Icon = reactionIcons[kind];
  return <Icon aria-hidden="true" size={21} strokeWidth={2.25} />;
}

export function SocialPostCard({
  post,
  viewerId,
  onBlocked,
}: {
  post: SocialPostView;
  viewerId?: string;
  onBlocked?: (authorId: string) => void;
}) {
  const [hidden, setHidden] = useState(false);
  const authenticated = "viewerReaction" in post;
  if (hidden) return null;
  const path = socialPostPath(post.id);
  return (
    <article
      data-social-post-id={post.id}
      className="min-w-0 overflow-hidden rounded-[22px] border border-[color:var(--px-border)] bg-[color:var(--px-surface)] p-4 shadow-sm sm:p-5"
    >
      <header className="mb-3 flex min-w-0 items-center gap-3">
        <Link
          aria-label={`View ${post.author.name} profile`}
          className="shrink-0 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)]"
          href={`/u/${encodeURIComponent(post.author.username)}`}
          prefetch={false}
        >
          <Avatar name={post.author.name} src={post.author.imageUrl} size={44} />
        </Link>
        <div className="min-w-0">
          <Link
            className="block truncate text-sm font-bold text-[color:var(--px-text)] hover:text-[color:var(--px-primary)]"
            href={`/u/${encodeURIComponent(post.author.username)}`}
            prefetch={false}
          >
            {post.author.name}
          </Link>
          <time
            className="text-xs text-[color:var(--px-text-muted)]"
            dateTime={post.publishedAt}
          >
            {new Date(post.publishedAt).toLocaleDateString("en-GB", {
              timeZone: "UTC",
            })}
          </time>
        </div>
        {authenticated && viewerId && viewerId !== post.author.id ? (
          <SocialAuthorActions
            authorId={post.author.id}
            authorName={post.author.name}
            username={post.author.username}
            reportContent={{ kind: "POST", id: post.id }}
            onBlocked={(authorId) => {
              setHidden(true);
              onBlocked?.(authorId);
            }}
          />
        ) : null}
      </header>
      <Link href={path} prefetch={false} aria-label="Open post" className="block rounded-xl py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)]">
        <p className="whitespace-pre-wrap break-words text-sm leading-6 text-[color:var(--px-text)] [overflow-wrap:anywhere]">
          {post.body}
        </p>
      </Link>
      <div className="mt-4 flex flex-wrap gap-4 text-xs text-[color:var(--px-text-muted)]">
        <span data-testid="reaction-count">{post.reactionCount} reactions</span>
        <Link href={`${path}#comments`} prefetch={false} data-testid="comment-count">
          {post.commentCount} comments
        </Link>
      </div>
      <div className="mt-3 border-t border-[color:var(--px-border)] pt-3">
        {authenticated ? (
          <ReactionControls post={post} />
        ) : (
          <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
            {reactionKinds.map((kind) => (
              <Link
                key={kind}
                className="inline-flex min-h-12 min-w-0 w-full items-center justify-center rounded-xl border border-[color:var(--px-border-strong)] bg-[color:var(--px-surface)] p-2 text-[color:var(--px-text)] shadow-sm transition motion-safe:hover:-translate-y-0.5 hover:border-[color:var(--px-primary)] hover:bg-[color:var(--px-primary-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)] motion-reduce:transform-none"
                aria-label={reactionLabels[kind]}
                title={reactionLabels[kind]}
                href={socialSignInPath(post.id)}
              >
                <ReactionIcon kind={kind} />
              </Link>
            ))}
          </div>
        )}
        <div className="mt-2 flex flex-wrap items-center justify-between gap-1 border-t border-[color:var(--px-border)] pt-2">
          <Link
            className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-bold text-[color:var(--px-primary)] hover:bg-[color:var(--px-primary-soft)]"
            href={authenticated ? `${path}#comments` : socialSignInPath(post.id)}
            prefetch={false}
          >
            <MessageCircle aria-hidden size={17} />
            {authenticated ? "Comment" : "Sign in to comment"}
          </Link>
          <ShareButton href={path} />
        </div>
      </div>
    </article>
  );
}
function ReactionControls({ post }: { post: SocialPostView }) {
  const [state, submit, pending] = useActionState(setPostReactionAction, {
    status: "idle",
  });
  const router = useRouter();
  useEffect(() => {
    if (state.status === "success") router.refresh();
  }, [state, router]);
  return (
    <form action={submit}>
      <input type="hidden" name="postId" value={post.id} />
      <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
        {reactionKinds.map((kind) => (
          <button
            className={`inline-flex min-h-12 min-w-0 w-full items-center justify-center rounded-xl border p-2 shadow-sm transition motion-safe:hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transform-none ${
              post.viewerReaction === kind
                ? "border-[color:var(--px-primary)] bg-[color:var(--px-primary-soft)] text-[color:var(--px-primary-ink)] ring-1 ring-inset ring-[color:var(--px-primary)]"
                : "border-[color:var(--px-border-strong)] bg-[color:var(--px-surface)] text-[color:var(--px-text)] hover:border-[color:var(--px-primary)] hover:bg-[color:var(--px-primary-soft)]"
            }`}
            key={kind}
            name="kind"
            type="submit"
            value={post.viewerReaction === kind ? "" : kind}
            aria-pressed={post.viewerReaction === kind}
            aria-label={reactionLabels[kind]}
            title={reactionLabels[kind]}
            disabled={pending}
          >
            <ReactionIcon kind={kind} />
          </button>
        ))}
      </div>
      {state.status === "error" && (
        <p role="alert" className="text-sm text-[color:var(--px-error)]">
          {state.message}
        </p>
      )}
    </form>
  );
}
