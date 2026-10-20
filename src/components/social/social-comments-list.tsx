"use client";

import { useState } from "react";
import Link from "next/link";
import { Link2 } from "lucide-react";

import { SocialAuthorActions } from "@/components/social/social-author-actions";
import { SocialForm } from "@/components/social/social-form";
import { deleteCommentAction, editCommentAction } from "@/features/social/actions";
import {
  COMMENT_MAX_LENGTH,
  socialPostPath,
  type SocialCommentView,
} from "@/lib/social/contracts";

/** Client-side removal instantly hides all visible comments from a newly
 * blocked member; server-side viewer-scoped queries enforce it on refresh. */
export function SocialCommentsList({
  comments,
  postId,
  viewerId,
}: {
  comments: SocialCommentView[];
  postId: string;
  viewerId?: string;
}) {
  const [blockedAuthors, setBlockedAuthors] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  return (
    <div className="grid min-w-0 gap-4" aria-label="Community comments">
      {comments
        .filter((comment) => !blockedAuthors.has(comment.author.id))
        .map((comment) => {
          const ownComment = viewerId === comment.author.id;
          return (
            <article
              key={comment.id}
              id={`comment-${comment.id}`}
              data-comment-id={comment.id}
              className="min-w-0 scroll-mt-28 rounded-xl border border-[color:var(--px-border)] bg-[color:var(--px-surface)] p-4"
            >
              <div className="flex min-w-0 items-center gap-2">
                <div className="min-w-0 flex-1">
                  <Link
                    className="block truncate text-sm font-bold text-[color:var(--px-text)] hover:text-[color:var(--px-primary)]"
                    href={`/u/${encodeURIComponent(comment.author.username)}`}
                  >
                    {comment.author.name}
                  </Link>
                  <time
                    className="text-xs text-[color:var(--px-text-muted)]"
                    dateTime={comment.createdAt}
                  >
                    {new Date(comment.createdAt).toLocaleDateString("en-GB", {
                      timeZone: "UTC",
                    })}
                  </time>
                </div>
                <Link
                  aria-label={`Link to comment by ${comment.author.name}`}
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-[color:var(--px-primary-ink)] hover:bg-[color:var(--px-muted)] focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)]"
                  href={`${socialPostPath(postId)}#comment-${encodeURIComponent(comment.id)}`}
                >
                  <Link2 aria-hidden size={17} />
                </Link>
                {viewerId && !ownComment ? (
                  <SocialAuthorActions
                    authorId={comment.author.id}
                    authorName={comment.author.name}
                    username={comment.author.username}
                    reportContent={{ kind: "COMMENT", id: comment.id }}
                    onBlocked={(authorId) =>
                      setBlockedAuthors((current) => new Set([...current, authorId]))
                    }
                  />
                ) : null}
              </div>
              <p className="my-3 whitespace-pre-wrap break-words text-sm leading-6 text-[color:var(--px-text)] [overflow-wrap:anywhere]">
                {comment.body}
              </p>
              {ownComment ? (
                <div className="grid gap-3">
                  <details>
                    <summary className="min-h-11 cursor-pointer font-semibold text-[color:var(--px-text)]">
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
              ) : null}
            </article>
          );
        })}
    </div>
  );
}
