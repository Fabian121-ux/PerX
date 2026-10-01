"use server";
import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { getCurrentUser } from "@/lib/auth/session";
import { assertAccountAccessWithClient } from "@/lib/account/enforcement";
import { getPrisma } from "@/lib/db/prisma";
import { socialPostWhere } from "@/lib/data/social-posts";
import { hasCapability } from "@/lib/permissions/capabilities";
import { evaluatePolicy } from "@/lib/policy/enforcement";
import { logServerDataError } from "@/lib/logging/runtime";
import {
  COMMENT_MAX_LENGTH,
  POST_MAX_LENGTH,
  reactionKinds,
  socialPostPath,
  socialSignInPath,
  type SocialFormState,
} from "@/lib/social/contracts";

class SocialError extends Error {}
const idSchema = z.string().min(1).max(128);
function id(form: FormData, key: string) {
  const r = idSchema.safeParse(form.get(key));
  if (!r.success) throw new SocialError("Invalid content identifier.");
  return r.data;
}
function body(form: FormData, max: number, actorId: string) {
  const r = z
    .string()
    .transform((v) => v.normalize("NFC").replace(/\r\n?/g, "\n").trim())
    .pipe(z.string().min(1).max(max))
    .safeParse(form.get("body"));
  if (!r.success)
    throw new SocialError(`Enter between 1 and ${max} characters.`);
  const policy = evaluatePolicy({
    actorId,
    content: r.data,
    entityType: "post",
  });
  if (policy.outcome !== "ALLOW")
    throw new SocialError(
      "This content cannot be published. Please review it before trying again.",
    );
  return r.data;
}
async function actor(postId?: string) {
  const user = await getCurrentUser();
  if (!user) redirect(socialSignInPath(postId));
  return user;
}
async function writable(tx: Prisma.TransactionClient, userId: string) {
  const error = await assertAccountAccessWithClient(tx, userId, "publish");
  if (error) throw new SocialError(error);
}
async function lockPost(tx: Prisma.TransactionClient, postId: string) {
  await tx.$queryRaw`SELECT id FROM "Post" WHERE id = ${postId} FOR UPDATE`;
}
async function visible(
  tx: Prisma.TransactionClient,
  postId: string,
  userId: string,
) {
  await lockPost(tx, postId);
  const row = await tx.post.findFirst({
    where: { ...socialPostWhere(userId), id: postId },
  });
  if (!row) throw new SocialError("This post is unavailable.");
  return row;
}
async function audit(
  tx: Prisma.TransactionClient,
  actorId: string,
  action: string,
  entityId: string,
  entityType = "post",
) {
  await tx.auditLog.create({
    data: { actorId, action: `social.${action}`, entityType, entityId },
  });
}
async function perform(
  run: () => Promise<{ id: string; postId?: string }>,
): Promise<SocialFormState> {
  try {
    const result = await run();
    revalidatePath("/");
    revalidatePath("/app");
    revalidatePath("/posts");
    revalidatePath(socialPostPath(result.postId ?? result.id));
    revalidatePath("/admin/social");
    return { status: "success", id: result.id, message: "Changes saved." };
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof SocialError)
      return { status: "error", message: error.message };
    logServerDataError({
      error,
      operation: "social mutation",
      route: "social",
    });
    return {
      status: "error",
      message: "This action is temporarily unavailable. Please try again.",
    };
  }
}
export async function createPostAction(
  _state: SocialFormState,
  form: FormData,
) {
  return perform(async () => {
    const user = await actor();
    const content = body(form, POST_MAX_LENGTH, user.id);
    return getPrisma().$transaction(async (tx) => {
      await writable(tx, user.id);
      const post = await tx.post.create({
        data: {
          authorId: user.id,
          body: content,
          status: "PUBLISHED",
          moderationStatus: "APPROVED",
          publishedAt: new Date(),
        },
      });
      await audit(tx, user.id, "post.created", post.id);
      return { id: post.id };
    });
  });
}
export async function editPostAction(_state: SocialFormState, form: FormData) {
  return perform(async () => {
    const postId = id(form, "postId"),
      user = await actor(postId),
      content = body(form, POST_MAX_LENGTH, user.id);
    return getPrisma().$transaction(async (tx) => {
      await writable(tx, user.id);
      const post = await visible(tx, postId, user.id);
      if (post.authorId !== user.id)
        throw new SocialError("Only the author can edit this post.");
      await tx.post.update({ where: { id: postId }, data: { body: content } });
      await audit(tx, user.id, "post.edited", postId);
      return { id: postId };
    });
  });
}
export async function deletePostAction(
  _state: SocialFormState,
  form: FormData,
) {
  return perform(async () => {
    const postId = id(form, "postId"),
      user = await actor(postId);
    return getPrisma().$transaction(async (tx) => {
      await lockPost(tx, postId);
      const post = await tx.post.findUnique({ where: { id: postId } });
      if (!post || post.authorId !== user.id)
        throw new SocialError("Only the author can delete this post.");
      await tx.post.update({
        where: { id: postId },
        data: { deletedAt: new Date() },
      });
      await audit(tx, user.id, "post.deleted", postId);
      return { id: postId };
    });
  });
}
/** Desired state is idempotent. The UI sends empty kind when clicking the active reaction. */
export async function setPostReactionAction(
  _state: SocialFormState,
  form: FormData,
) {
  return perform(async () => {
    const postId = id(form, "postId"),
      user = await actor(postId);
    const parsed = z.enum([...reactionKinds, ""]).safeParse(form.get("kind"));
    if (!parsed.success) throw new SocialError("Choose a valid reaction.");
    return getPrisma().$transaction(async (tx) => {
      await visible(tx, postId, user.id);
      const error = await assertAccountAccessWithClient(
        tx,
        user.id,
        "application",
      );
      if (error) throw new SocialError(error);
      if (parsed.data === "")
        await tx.postReaction.deleteMany({
          where: { postId, userId: user.id },
        });
      else
        await tx.postReaction.upsert({
          where: { postId_userId: { postId, userId: user.id } },
          create: { postId, userId: user.id, kind: parsed.data },
          update: { kind: parsed.data },
        });
      await audit(tx, user.id, "reaction.updated", postId);
      return { id: postId };
    });
  });
}
export async function createCommentAction(
  _state: SocialFormState,
  form: FormData,
) {
  return perform(async () => {
    const postId = id(form, "postId"),
      user = await actor(postId),
      content = body(form, COMMENT_MAX_LENGTH, user.id);
    return getPrisma().$transaction(async (tx) => {
      await writable(tx, user.id);
      await visible(tx, postId, user.id);
      const comment = await tx.postComment.create({
        data: { postId, authorId: user.id, body: content },
      });
      await audit(tx, user.id, "comment.created", comment.id, "post_comment");
      return { id: comment.id, postId };
    });
  });
}
async function changeComment(form: FormData, remove: boolean) {
  return perform(async () => {
    const postId = id(form, "postId"),
      commentId = id(form, "commentId"),
      user = await actor(postId);
    const content = remove
      ? undefined
      : body(form, COMMENT_MAX_LENGTH, user.id);
    return getPrisma().$transaction(async (tx) => {
      if (!remove) await writable(tx, user.id);
      await lockPost(tx, postId);
      const comment = await tx.postComment.findFirst({
        where: { id: commentId, postId, deletedAt: null },
      });
      if (!comment || comment.authorId !== user.id)
        throw new SocialError("Only the author can change this comment.");
      if (!remove) {
        await visible(tx, postId, user.id);
        if (comment.moderationStatus !== "APPROVED")
          throw new SocialError("This comment is unavailable.");
      }
      await tx.postComment.update({
        where: { id: commentId },
        data: remove ? { deletedAt: new Date() } : { body: content },
      });
      await audit(
        tx,
        user.id,
        remove ? "comment.deleted" : "comment.edited",
        commentId,
        "post_comment",
      );
      return { id: commentId, postId };
    });
  });
}
export async function editCommentAction(
  _state: SocialFormState,
  form: FormData,
) {
  return changeComment(form, false);
}
export async function deleteCommentAction(
  _state: SocialFormState,
  form: FormData,
) {
  return changeComment(form, true);
}
export async function moderateSocialAction(
  _state: SocialFormState,
  form: FormData,
) {
  return perform(async () => {
    const user = await actor();
    if (!hasCapability(user.roles, "admin:moderate"))
      throw new SocialError("Moderation access required.");
    const targetId = id(form, "targetId"),
      targetType = z
        .enum(["post", "comment"])
        .safeParse(form.get("targetType")),
      reason = z.string().trim().min(8).max(1000).safeParse(form.get("reason"));
    if (!targetType.success || !reason.success)
      throw new SocialError(
        "Choose content and give a reason of 8–1000 characters.",
      );
    return getPrisma().$transaction(async (tx) => {
      const postId =
        targetType.data === "post"
          ? targetId
          : (
              await tx.postComment.findUnique({
                where: { id: targetId },
                select: { postId: true },
              })
            )?.postId;
      if (!postId) throw new SocialError("Content unavailable.");
      await lockPost(tx, postId);
      if (targetType.data === "post")
        await tx.post.update({
          where: { id: targetId },
          data: { moderationStatus: "REJECTED" },
        });
      else
        await tx.postComment.update({
          where: { id: targetId },
          data: { moderationStatus: "REJECTED" },
        });
      const entityType = targetType.data === "post" ? "post" : "post_comment";
      await tx.moderationAction.create({
        data: {
          actorId: user.id,
          entityType,
          entityId: targetId,
          action: "hide",
          reason: reason.data,
        },
      });
      await audit(
        tx,
        user.id,
        `${targetType.data}.hidden`,
        targetId,
        entityType,
      );
      return { id: targetId, postId };
    });
  });
}
