import Image from "next/image";

import { cn } from "@/lib/utils";

type BrandVariant = "logo" | "horizontal" | "symbol" | "wordmark";
type BrandTheme = "light" | "dark";

const assetMap: Record<BrandVariant, Record<BrandTheme, string>> = {
  logo: {
    light: "/brand/perx-logo-light.png",
    dark: "/brand/perx-logo-dark.png",
  },
  horizontal: {
    light: "/brand/perx-logo-horizontal-light.png",
    dark: "/brand/perx-logo-horizontal-dark.png",
  },
  symbol: {
    light: "/brand/perx-symbol-light.png",
    dark: "/brand/perx-symbol-dark.png",
  },
  wordmark: {
    light: "/brand/perx-wordmark-light.png",
    dark: "/brand/perx-wordmark-dark.png",
  },
};

const defaultDimensions: Record<BrandVariant, { width: number; height: number; className: string }> = {
  logo: { width: 420, height: 116, className: "h-10 w-auto" },
  horizontal: { width: 420, height: 116, className: "h-10 w-auto" },
  symbol: { width: 914, height: 273, className: "h-8 w-auto" },
  wordmark: { width: 176, height: 96, className: "h-8 w-auto" },
};

export function BrandLogo({
  ariaLabel = "perX",
  className,
  compact = false,
  dark,
  decorative = false,
  height,
  priority = false,
  theme,
  variant = "horizontal",
  width,
}: {
  ariaLabel?: string;
  className?: string;
  compact?: boolean;
  dark?: boolean;
  decorative?: boolean;
  height?: number;
  priority?: boolean;
  theme?: BrandTheme;
  variant?: BrandVariant;
  width?: number;
}) {
  const resolvedVariant = compact ? "symbol" : variant;
  const resolvedTheme = theme ?? (dark ? "dark" : "light");
  const dimensions = defaultDimensions[resolvedVariant];

  return (
    <Image
      alt={decorative ? "" : ariaLabel}
      aria-hidden={decorative ? true : undefined}
      className={cn("shrink-0 object-contain", dimensions.className, className)}
      height={height ?? dimensions.height}
      priority={priority}
      src={assetMap[resolvedVariant][resolvedTheme]}
      width={width ?? dimensions.width}
    />
  );
}

export function BrandSymbol({
  ariaLabel = "perX infinity symbol",
  className,
  decorative = false,
  dark,
  height,
  priority = false,
  theme,
  width,
}: {
  ariaLabel?: string;
  className?: string;
  decorative?: boolean;
  dark?: boolean;
  height?: number;
  priority?: boolean;
  theme?: BrandTheme;
  width?: number;
}) {
  return (
    <BrandLogo
      ariaLabel={ariaLabel}
      className={className}
      compact
      dark={dark}
      decorative={decorative}
      height={height}
      priority={priority}
      theme={theme}
      width={width}
    />
  );
}
