import Link from "next/link";
import { notFound, unstable_rethrow } from "next/navigation";
import { PublicPageShell } from "@/components/standard-page";
import { getCurrentUser } from "@/lib/auth/session";
import { getSocialPost } from "@/lib/data/social-posts";
import { SocialPostCard } from "@/components/social/social-post-card";
import { SocialForm } from "@/components/social/social-form";
import {
  createCommentAction,
  editCommentAction,
  deleteCommentAction,
  editPostAction,
  deletePostAction,
} from "@/features/social/actions";
import {
  POST_MAX_LENGTH,
  COMMENT_MAX_LENGTH,
  socialPostPath,
  socialSignInPath,
} from "@/lib/social/contracts";
import { logServerDataError } from "@/lib/logging/runtime";
export const dynamic = "force-dynamic";
export default async function PostPage({
  params,
  searchParams,
}: {
  params: Promise<{ postId: string }>;
  searchParams: Promise<{ cursor?: string }>;
}) {
  const { postId } = await params;
  const { cursor } = await searchParams;
  const user = await getCurrentUser();
  let detail;
  try {
    detail = await getSocialPost(postId, user?.id, cursor);
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof Error && error.message.startsWith("Invalid cursor"))
      notFound();
    logServerDataError({
      error,
      operation: "social post detail",
      route: "/posts/[postId]",
    });
    return (
      <PublicPageShell>
        <main className="mx-auto max-w-[640px] p-4">
          <h1>Post temporarily unavailable</h1>
          <p>Please try again shortly.</p>
        </main>
      </PublicPageShell>
    );
  }
  if (!detail) notFound();
  return (
    <PublicPageShell>
      <main className="mx-auto grid min-w-0 max-w-[640px] gap-4 px-2 py-4 sm:px-4">
        <h1 className="sr-only">Community post</h1>
        <SocialPostCard post={detail.post} />
        {user?.id === detail.post.author.id && (
          <section
            className="grid gap-4 rounded-xl border border-[color:var(--px-border)] p-4"
            aria-label="Manage your post"
          >
            <details>
              <summary className="min-h-11 cursor-pointer font-semibold">
                Edit post
              </summary>
              <SocialForm
                action={editPostAction}
                fields={{ postId }}
                label="Save post"
                inputLabel="Post text"
                initialBody={detail.post.body}
                maxLength={POST_MAX_LENGTH}
              />
            </details>
            <SocialForm
              action={deletePostAction}
              fields={{ postId }}
              label="Delete post"
              deletedPost
            />
          </section>
        )}
        <section
          id="comments"
          className="grid min-w-0 gap-4"
          aria-label="Comments"
        >
          <h2 className="text-lg font-bold">Comments</h2>
          {user ? (
            <SocialForm
              action={createCommentAction}
              fields={{ postId }}
              label="Post comment"
              inputLabel="Your comment"
              maxLength={COMMENT_MAX_LENGTH}
            />
          ) : (
            <Link
              className="py-3 font-semibold"
              href={socialSignInPath(postId)}
            >
              Sign in to write a comment
            </Link>
          )}
          {detail.comments.map((comment) => (
            <article
              key={comment.id}
              data-comment-id={comment.id}
              className="min-w-0 rounded-xl border border-[color:var(--px-border)] bg-[color:var(--px-surface)] p-4"
            >
              <Link
                className="font-semibold"
                href={`/u/${encodeURIComponent(comment.author.username)}`}
              >
                {comment.author.name}
              </Link>
              <time className="ml-2 text-xs" dateTime={comment.createdAt}>
                {new Date(comment.createdAt).toLocaleDateString("en-GB", {
                  timeZone: "UTC",
                })}
              </time>
              <p className="my-3 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                {comment.body}
              </p>
              {user?.id === comment.author.id && (
                <div className="grid gap-3">
                  <details>
                    <summary className="min-h-11 cursor-pointer">
                      Edit comment
                    </summary>
                    <SocialForm
                      action={editCommentAction}
                      fields={{ postId, commentId: comment.id }}
                      label="Save comment"
                      inputLabel="Comment text"
                      initialBody={comment.body}
                      maxLength={COMMENT_MAX_LENGTH}
                    />
                  </details>
                  <SocialForm
                    action={deleteCommentAction}
                    fields={{ postId, commentId: comment.id }}
                    label="Delete comment"
                  />
                </div>
              )}
            </article>
          ))}
          {detail.nextCursor && (
            <Link
              href={`${socialPostPath(postId)}?cursor=${encodeURIComponent(detail.nextCursor)}#comments`}
            >
              More comments
            </Link>
          )}
        </section>
      </main>
    </PublicPageShell>
  );
}
