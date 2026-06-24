import { cn } from "@/lib/utils";

export function BrandLogo({
  className,
  compact = false,
}: {
  className?: string;
  dark?: boolean;
  compact?: boolean;
}) {
  if (compact) {
    return <BrandSymbol className={className} />;
  }

  return (
    <span
      aria-label="perX"
      className={cn("inline-flex items-center gap-2.5 whitespace-nowrap", className)}
      role="img"
    >
      <BrandSymbol className="h-8 w-10 shrink-0 text-[color:var(--px-gold-bright)]" decorative />
      <span className="text-[1.55rem] font-black leading-none tracking-normal">
        <span className="text-[color:var(--px-text)]">per</span>
        <span className="text-[color:var(--px-gold-bright)]">X</span>
      </span>
    </span>
  );
}

export function BrandSymbol({
  className,
  decorative = false,
}: {
  className?: string;
  decorative?: boolean;
}) {
  return (
    <svg
      aria-hidden={decorative ? true : undefined}
      aria-label={decorative ? undefined : "perX infinity symbol"}
      className={cn("h-8 w-12 overflow-visible", className)}
      fill="none"
      role={decorative ? undefined : "img"}
      viewBox="0 0 92 54"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M13.8 27c0-9.6 7-17.3 16-17.3 7.2 0 12.5 4.8 18 13.2l4.3 6.5c5.5 8.4 10.7 14.9 19.6 14.9 9 0 16.2-7.7 16.2-17.3S80.7 9.7 71.7 9.7c-8.9 0-14.1 6.5-19.6 14.9l-4.3 6.5c-5.5 8.4-10.8 13.2-18 13.2-9 0-16-7.7-16-17.3Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="9"
      />
      <path
        d="M22.5 27c0-4.7 3.2-8.4 7.4-8.4 4.4 0 7.9 3.9 12.1 10.1l2.9 4.2"
        stroke="#fff0bd"
        strokeLinecap="round"
        strokeWidth="3"
        opacity="0.5"
      />
    </svg>
  );
}
