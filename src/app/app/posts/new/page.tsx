import { requireUser } from "@/lib/auth/session";
import { SocialForm } from "@/components/social/social-form";
import { createPostAction } from "@/features/social/actions";
import { POST_MAX_LENGTH } from "@/lib/social/contracts";
export default async function NewPostPage() {
  await requireUser();
  return (
    <main className="mx-auto grid w-full min-w-0 max-w-[640px] gap-4">
      <h1 className="text-2xl font-bold">Share an update</h1>
      <p>Share progress, an insight or a question with the community.</p>
      <SocialForm
        action={createPostAction}
        label="Publish post"
        inputLabel="Post text"
        maxLength={POST_MAX_LENGTH}
        navigateToPost
      />
    </main>
  );
}
