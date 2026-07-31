-- Sponsored content infrastructure. Adds a new self-contained model for
-- published brand-sponsored cards shown on Home. Does not alter any existing
-- table, enum, index, or relationship. All statements are idempotent.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SponsoredContentStatus') THEN
    CREATE TYPE "SponsoredContentStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'PAUSED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "SponsoredContent" (
  "id" TEXT NOT NULL,
  "brandName" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "ctaLabel" TEXT NOT NULL,
  "ctaHref" TEXT NOT NULL,
  "imageUrl" TEXT,
  "status" "SponsoredContentStatus" NOT NULL DEFAULT 'DRAFT',
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SponsoredContent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SponsoredContent_status_startsAt_idx"
  ON "SponsoredContent"("status", "startsAt");
CREATE INDEX IF NOT EXISTS "SponsoredContent_status_startsAt_endsAt_idx"
  ON "SponsoredContent"("status", "startsAt", "endsAt");