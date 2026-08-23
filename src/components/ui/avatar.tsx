import Image from "next/image";

/**
 * Shared avatar.
 *
 * Avatars are the most repeated image in PerX - feed cards, profiles, message
 * lists, network results, settings. They were previously rendered by a mix of
 * raw `<img>` tags (bypassing optimization entirely) and ad-hoc `next/image`
 * calls with inconsistent sizing, so a 48px avatar could download a 5 MB
 * upload at full resolution.
 *
 * Routing every avatar through one component means:
 * - the optimizer always receives an explicit pixel size, so it can emit a
 *   correctly-sized AVIF/WebP derivative instead of the original
 * - the rendered box is reserved before the image loads, so no layout shift
 * - the initials fallback is identical everywhere
 *
 * A Server Component: it renders markup only, so it adds nothing to the client
 * bundle and can be used inside server-rendered lists.
 */
export function Avatar({
  className = "",
  name,
  /** Rendered CSS size in pixels. Also drives the requested source width. */
  size = 44,
  src,
  /** Only the handful of avatars genuinely above the fold should set this. */
  priority = false,
}: {
  className?: string;
  name: string;
  size?: number;
  src?: string | null;
  priority?: boolean;
}) {
  const dimension = `${size}px`;

  if (!src) {
    return (
      <span
        aria-hidden
        className={`grid shrink-0 place-items-center overflow-hidden rounded-full bg-[color:var(--px-primary)] font-black text-white ${className}`}
        style={{ height: dimension, width: dimension }}
      >
        {getInitials(name)}
      </span>
    );
  }

  return (
    <span
      className={`relative block shrink-0 overflow-hidden rounded-full bg-[color:var(--px-muted)] ${className}`}
      // Reserving the box here rather than on the image keeps the space stable
      // even while the source is still loading or has failed.
      style={{ height: dimension, width: dimension }}
    >
      <Image
        alt={`${name} profile photo`}
        className="object-cover"
        fill
        loading={priority ? "eager" : "lazy"}
        priority={priority}
        /*
          Avatars never scale with the viewport, so a fixed hint is correct and
          lets the optimizer serve exactly one small derivative. Doubling covers
          2x displays without requesting the full original.
        */
        sizes={`${size * 2}px`}
        src={src}
      />
    </span>
  );
}

export function getInitials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
