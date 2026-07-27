"use client";

import { Loader2 } from "lucide-react";
import { useFormStatus } from "react-dom";

import { Button, type ButtonProps } from "@/components/ui/button";

export function PendingSubmitButton({
  children,
  pendingLabel = "Working...",
  ...props
}: ButtonProps & {
  pendingLabel?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <Button {...props} disabled={pending || props.disabled}>
      {pending ? (
        <>
          <Loader2 aria-hidden className="mr-2 animate-spin" size={15} />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
