import { getSafeAuthRedirect } from "@/lib/auth/redirects";
export const POST_MAX_LENGTH = 5000;
export const COMMENT_MAX_LENGTH = 2000;
export const reactionKinds = [
  "LIKE",
  "CELEBRATE",
  "SUPPORT",
  "INSIGHTFUL",
] as const;
export type ReactionKind = (typeof reactionKinds)[number];
export const reactionLabels: Record<ReactionKind, string> = {
  LIKE: "Like",
  CELEBRATE: "Celebrate",
  SUPPORT: "Support",
  INSIGHTFUL: "Insightful",
};
export type SocialFormState = {
  status: "idle" | "success" | "error";
  message?: string;
  id?: string;
};
export function socialPostPath(id: string) {
  return `/posts/${encodeURIComponent(id)}`;
}
export function socialSignInPath(id?: string) {
  return `/sign-in?next=${encodeURIComponent(getSafeAuthRedirect(id ? socialPostPath(id) : "/app/posts/new", "/app"))}`;
}
export type SocialAuthor = {
  id: string;
  name: string;
  username: string;
  imageUrl: string | null;
};
export type SocialPostView = {
  kind: "SOCIAL_POST";
  id: string;
  body: string;
  author: SocialAuthor;
  publishedAt: string;
  reactionCount: number;
  commentCount: number;
  viewerReaction?: ReactionKind | null;
};
export type SocialCommentView = {
  id: string;
  body: string;
  author: SocialAuthor;
  createdAt: string;
  updatedAt: string;
};
