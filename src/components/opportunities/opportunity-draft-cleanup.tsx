"use client";

import { useEffect } from "react";

import { clearOpportunityComposerDraft } from "@/lib/opportunities/composer-draft";

export function OpportunityDraftCleanup({
  type,
  userId,
}: {
  type: string;
  userId: string;
}) {
  useEffect(() => {
    clearOpportunityComposerDraft(userId, type);
  }, [type, userId]);

  return null;
}
