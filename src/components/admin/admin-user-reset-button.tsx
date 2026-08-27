"use client";

import { PendingSubmitButton } from "@/components/ui/pending-submit-button";

export function AdminUserResetButton() {
  return (
    <PendingSubmitButton
      pendingLabel="Sending reset link"
      size="sm"
      type="submit"
      variant="secondary"
    >
      Send password reset link
    </PendingSubmitButton>
  );
}
