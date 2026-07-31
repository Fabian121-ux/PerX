import type { Prisma } from "@/generated/prisma/client";
import type {
  SponsoredContentStatus,
} from "@/generated/prisma/enums";
import { getPrisma } from "@/lib/db/prisma";
import { isProductionMockModeError } from "@/lib/env";
import { logServerDataError } from "@/lib/logging/runtime";

export const DEFAULT_SPONSORED_LIMIT = 1;
export const MAX_SPONSORED_LIMIT = 5;

export type PublicSponsoredContent = {
  id: string;
  brandName: string;
  message: string;
  ctaLabel: string;
  ctaHref: string;
  imageUrl: string | null;
};

type SponsoredRow = {
  id: string;
  brandName: string;
  message: string;
  ctaLabel: string;
  ctaHref: string;
  imageUrl: string | null;
  status: SponsoredContentStatus;
  startsAt: Date;
  endsAt: Date | null;
  createdAt: Date;
};

export function clampSponsoredLimit(limit?: number): number {
  if (limit === undefined || !Number.isFinite(limit)) {
    return DEFAULT_SPONSORED_LIMIT;
  }

  return Math.max(1, Math.min(Math.trunc(limit), MAX_SPONSORED_LIMIT));
}

/**
 * Validates that a sponsored CTA href is a safe internal path only.
 *
 * Accepts origin-relative paths such as "/discover" or "/app/news?tab=all".
 * Rejects absolute URLs, protocol-relative URLs ("//evil.com"), scheme URIs
 * ("javascript:", "data:"), backslashes, and control/whitespace characters
 * that could be used for attribute injection. A leading "/" is what keeps
 * schemes unreachable.
 */
export function isSafeInternalHref(
  href: string | null | undefined,
): href is string {
  if (typeof href !== "string") return false;

  const trimmed = href.trim();
  if (!trimmed || trimmed.length > 200) return false;
  if (!trimmed.startsWith("/")) return false;
  if (trimmed.startsWith("//")) return false;
  if (trimmed.includes("\\")) return false;
  if (/[\s\u0000-\u001F\u007F]/.test(trimmed)) return false;

  return true;
}

export function buildActiveSponsoredContentWhere(
  now: Date = new Date(),
): Prisma.SponsoredContentWhereInput {
  return {
    OR: [{ endsAt: null }, { endsAt: { gte: now } }],
    startsAt: { lte: now },
    status: "PUBLISHED",
  };
}

function isMockModeError(error: unknown) {
  return (
    error instanceof Error &&
    error.message.includes("PERX_DATA_MODE")
  );
}

export function toPublicSponsoredContent(
  row: SponsoredRow,
): PublicSponsoredContent | null {
  if (!isSafeInternalHref(row.ctaHref)) return null;

  return {
    brandName: row.brandName,
    ctaHref: row.ctaHref.trim(),
    ctaLabel: row.ctaLabel,
    id: row.id,
    imageUrl: row.imageUrl,
    message: row.message,
  };
}

export type ActiveSponsoredContentResult = {
  items: PublicSponsoredContent[];
  unavailable: boolean;
};

export async function getActiveSponsoredContentResult({
  limit,
  now = new Date(),
}: {
  limit?: number;
  now?: Date;
} = {}): Promise<ActiveSponsoredContentResult> {
  try {
    const take = clampSponsoredLimit(limit);
    const rows = await getPrisma().sponsoredContent.findMany({
      orderBy: [{ startsAt: "desc" }, { createdAt: "desc" }, { id: "desc" }],
      take,
      where: buildActiveSponsoredContentWhere(now),
    });
    const items = rows
      .map(toPublicSponsoredContent)
      .filter((item): item is PublicSponsoredContent => item !== null);

    return { items, unavailable: false };
  } catch (error) {
    if (isProductionMockModeError(error)) throw error;
    // Mock and preview data modes intentionally have no sponsored content
    // (no fake campaigns). Surface those as an empty slot without log noise.
    if (isMockModeError(error)) return { items: [], unavailable: true };

    logServerDataError({
      error,
      operation: "sponsored content feed",
      route: "public",
    });

    return { items: [], unavailable: true };
  }
}