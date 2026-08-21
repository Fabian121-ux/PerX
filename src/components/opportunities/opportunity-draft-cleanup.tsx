"use client";

import { useEffect } from "react";

import { clearFeedCache } from "@/lib/feed/feed-cache";
import { clearOpportunityComposerDraft } from "@/lib/opportunities/composer-draft";

/**
 * Post-publish cleanup.
 *
 * Mounted by the success destination only after the server has confirmed the
 * created id and type, so a stale or forged query parameter cannot trigger it.
 *
 * Besides clearing the browser draft, this drops the cached Home feed. The
 * server already revalidates `/app`, but the client cache is a separate copy
 * held in `sessionStorage` - without this the author would return to Home and
 * see the pre-publish feed restored over the fresh one, i.e. their new post
 * would appear to be missing.
 */
export function OpportunityDraftCleanup({
  type,
  userId,
}: {
  type: string;
  userId: string;
}) {
  useEffect(() => {
    clearOpportunityComposerDraft(userId, type);
    clearFeedCache();
  }, [type, userId]);

  return null;
}
