import { getActiveSponsoredContentResult } from "@/lib/data/sponsored-content";
import { SponsoredCard } from "./sponsored-card";

export type SponsoredSlotProps = {
  limit?: number;
  className?: string;
};

/**
 * Fetches real published sponsored content within its active date window and
 * renders a single compact SponsoredCard, or nothing at all. When no
 * published sponsored content exists (the default in production) this slot
 * renders nothing and adds no markup to the page.
 *
 * The slot is rendered inline in normal document flow and never uses fixed
 * or overlay positioning, so it cannot cover the mobile navigation.
 */
export async function SponsoredSlot({
  limit,
  className,
}: SponsoredSlotProps = {}) {
  const { items } = await getActiveSponsoredContentResult({ limit });
  if (items.length === 0) return null;

  return <SponsoredCard content={items[0]} className={className} />;
}