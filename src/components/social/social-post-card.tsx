"use client";
import Link from "next/link";
import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/avatar";
import { setPostReactionAction } from "@/features/social/actions";
import {
  reactionKinds,
  reactionLabels,
  socialPostPath,
  socialSignInPath,
  type SocialPostView,
} from "@/lib/social/contracts";
export function SocialPostCard({ post }: { post: SocialPostView }) {
  const authenticated = "viewerReaction" in post;
  const path = socialPostPath(post.id);
  return (
    <article
      data-social-post-id={post.id}
      className="min-w-0 overflow-hidden rounded-[22px] border border-[color:var(--px-border)] bg-[color:var(--px-surface)] p-4 shadow-sm sm:p-5"
    >
      <header className="mb-3 flex min-w-0 items-center gap-3">
        <Avatar name={post.author.name} src={post.author.imageUrl} size={40} />
        <div className="min-w-0">
          <Link
            className="block truncate text-sm font-bold"
            href={`/u/${encodeURIComponent(post.author.username)}`}
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
      </header>
      <Link href={path} aria-label="Open post" className="block">
        <p className="whitespace-pre-wrap break-words text-sm leading-6 [overflow-wrap:anywhere]">
          {post.body}
        </p>
      </Link>
      <div className="mt-4 flex flex-wrap gap-4 text-xs text-[color:var(--px-text-muted)]">
        <span data-testid="reaction-count">{post.reactionCount} reactions</span>
        <Link href={`${path}#comments`} data-testid="comment-count">
          {post.commentCount} comments
        </Link>
      </div>
      <div className="mt-3 border-t border-[color:var(--px-border)] pt-3">
        {authenticated ? (
          <ReactionControls post={post} />
        ) : (
          <div className="flex flex-wrap gap-2">
            {reactionKinds.map((kind) => (
              <Link
                key={kind}
                className="inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-semibold hover:bg-[color:var(--px-muted)]"
                href={socialSignInPath(post.id)}
              >
                {reactionLabels[kind]}
              </Link>
            ))}
          </div>
        )}
        <Link
          className="inline-flex min-h-11 items-center text-sm font-bold text-[color:var(--px-primary)]"
          href={authenticated ? `${path}#comments` : socialSignInPath(post.id)}
        >
          {authenticated ? "Comment" : "Sign in to comment"}
        </Link>
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
      <div className="flex flex-wrap gap-2">
        {reactionKinds.map((kind) => (
          <button
            className="min-h-11 rounded-lg px-2 text-sm font-semibold aria-pressed:bg-[color:var(--px-primary-soft)] disabled:opacity-50"
            key={kind}
            name="kind"
            type="submit"
            value={post.viewerReaction === kind ? "" : kind}
            aria-pressed={post.viewerReaction === kind}
            disabled={pending}
          >
            {reactionLabels[kind]}
          </button>
        ))}
      </div>
      {state.status === "error" && (
        <p role="alert" className="text-sm">
          {state.message}
        </p>
      )}
    </form>
  );
}
