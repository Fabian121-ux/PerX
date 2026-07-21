"use client";

import { Eye, EyeOff } from "lucide-react";
import { type InputHTMLAttributes, useState, forwardRef } from "react";
import { Input } from "@/components/ui/form";
import { cn } from "@/lib/utils";

export interface PasswordInputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  hint?: string;
}

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, error, ...props }, ref) => {
    const [show, setShow] = useState(false);

    return (
      <span className="relative block w-full">
        <Input
          ref={ref}
          className={cn("w-full pr-14 font-sans tracking-normal", className)}
          type={show ? "text" : "password"}
          aria-invalid={Boolean(error)}
          {...props}
        />
        <button
          aria-label={show ? "Hide password" : "Show password"}
          className="absolute right-[12px] top-1/2 grid h-[40px] w-[40px] -translate-y-1/2 place-items-center rounded-[var(--px-radius-sm)] bg-transparent text-[color:var(--px-text-muted)] transition hover:text-[color:var(--px-text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)]"
          onClick={() => setShow(!show)}
          type="button"
        >
          {show ? <EyeOff aria-hidden size={20} /> : <Eye aria-hidden size={20} />}
        </button>
      </span>
    );
  }
);
PasswordInput.displayName = "PasswordInput";
