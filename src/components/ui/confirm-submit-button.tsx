"use client";

import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";

export function ConfirmSubmitButton({
  children,
  message,
}: {
  children: ReactNode;
  message: string;
}) {
  return (
    <Button
      onClick={(event) => {
        if (!window.confirm(message)) {
          event.preventDefault();
        }
      }}
      size="sm"
      type="submit"
      variant="destructive"
    >
      {children}
    </Button>
  );
}
