"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Image from "next/image";
import { useRef, useState, type KeyboardEvent, type TouchEvent } from "react";

export type ListingPhoto = { src: string; alt: string };

/**
 * Swipeable listing photos. Receives only the bounded, already-authorized
 * media selected by the detail provider; the UI never queries private media.
 */
export function ListingMediaGallery({ photos }: { photos: ListingPhoto[] }) {
  const [active, setActive] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const count = photos.length;
  const photo = photos[active];
  if (!photo) return null;

  const previous = () => setActive((index) => (index - 1 + count) % count);
  const next = () => setActive((index) => (index + 1) % count);
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (count < 2) return;
    if (event.key === "ArrowLeft") { event.preventDefault(); previous(); }
    if (event.key === "ArrowRight") { event.preventDefault(); next(); }
  };
  const onTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    touchStartX.current = event.touches[0]?.clientX ?? null;
  };
  const onTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    const start = touchStartX.current;
    const end = event.changedTouches[0]?.clientX;
    touchStartX.current = null;
    if (start === null || end === undefined || Math.abs(end - start) < 45) return;
    if (end < start) next();
    else previous();
  };

  return (
    <div
      aria-label="Listing photos"
      aria-roledescription="carousel"
      className="relative h-full w-full bg-[color:var(--px-muted)] outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[color:var(--px-focus)]"
      onKeyDown={onKeyDown}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      role="region"
      tabIndex={count > 1 ? 0 : undefined}
    >
      <Image
        alt={photo.alt}
        className="object-cover"
        fill
        priority={active === 0}
        sizes="(max-width: 1024px) 100vw, 820px"
        src={photo.src}
      />
      {count > 1 ? (
        <>
          <span aria-live="polite" className="absolute right-3 top-3 z-20 rounded-full bg-black/75 px-3 py-1 text-xs font-black text-white">
            {active + 1} / {count}
          </span>
          <button
            aria-label="Previous photo"
            className="absolute left-2 top-1/2 z-20 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-black/65 text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            onClick={previous}
            type="button"
          >
            <ChevronLeft aria-hidden size={22} />
          </button>
          <button
            aria-label="Next photo"
            className="absolute right-2 top-1/2 z-20 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-black/65 text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            onClick={next}
            type="button"
          >
            <ChevronRight aria-hidden size={22} />
          </button>
        </>
      ) : null}
    </div>
  );
}
