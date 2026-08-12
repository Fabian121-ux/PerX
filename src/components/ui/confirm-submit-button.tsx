"use client";

import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/feedback-provider";

export function ConfirmSubmitButton({
  children,
  message,
}: {
  children: ReactNode;
  message: string;
}) {
  const confirm = useConfirm();

  return (
    <Button
      onClick={async (event) => {
        event.preventDefault();
        const submitter = event.currentTarget;
        const approved = await confirm({
          confirmLabel: "Delete",
          description: message,
          title: "Delete this item?",
          tone: "danger",
        });
        if (approved) submitter.form?.requestSubmit(submitter);
      }}
      size="sm"
      type="submit"
      variant="destructive"
    >
      {children}
    </Button>
  );
}
