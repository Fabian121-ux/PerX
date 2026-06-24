import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils";

const variants = {
  ghost: "prex-btn-ghost border border-transparent",
  primary: "prex-btn-primary",
  secondary: "prex-btn-secondary",
  warm: "prex-btn-warm",
  outline: "border border-[color:var(--px-border-strong)] bg-transparent text-[color:var(--px-text)] hover:bg-[color:var(--px-surface-soft)]",
  destructive: "bg-[color:var(--px-error)] text-white hover:bg-red-600 focus:ring-red-600",
  icon: "hover:bg-[color:var(--px-muted)] text-[color:var(--px-text-muted)] hover:text-[color:var(--px-text)]",
};

const sizes = {
  default: "min-h-11 px-4 py-2",
  sm: "min-h-9 px-3 text-xs",
  lg: "min-h-12 px-8 text-base",
  icon: "h-11 w-11 p-0",
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
};

export function Button({ className, variant = "primary", size = "default", ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-[var(--px-radius-sm)] font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[color:var(--px-focus)] focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
}

type ButtonLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
  children: ReactNode;
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
};

export function ButtonLink({ children, className, href, variant = "primary", size = "default", ...props }: ButtonLinkProps) {
  return (
    <Link
      className={cn(
        "inline-flex items-center justify-center rounded-[var(--px-radius-sm)] font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[color:var(--px-focus)] focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      )}
      href={href}
      {...props}
    >
      {children}
    </Link>
  );
}
