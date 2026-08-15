import {
  forwardRef,
  type InputHTMLAttributes,
} from "react";

import { Input } from "@/components/ui/form";

export type MoneyInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "inputMode" | "type"
> & {
  "aria-label": string;
  currency: "EUR" | "GBP" | "NGN" | "USD";
};

export const MoneyInput = forwardRef<HTMLInputElement, MoneyInputProps>(
  ({ currency, maxLength = 24, ...props }, ref) => (
    <span className="relative block">
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-3 z-10 flex items-center text-xs font-black text-[color:var(--px-text-muted)]"
      >
        {currency}
      </span>
      <Input
        {...props}
        className="pl-16"
        inputMode="decimal"
        maxLength={maxLength}
        ref={ref}
        spellCheck={false}
        type="text"
      />
    </span>
  ),
);

MoneyInput.displayName = "MoneyInput";
