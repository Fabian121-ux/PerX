-- PtahX Logistics V1 (internal, consent-based trial)
-- Existing Deal "Delivery" represents work submission; never reinterpret it
-- as physical parcel movement. No public Data API access to private GPS data.
CREATE TABLE "LogisticsV1Shipment" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ASSIGNED',
    "acceptedAt" TIMESTAMP(3),
    "sharingUntil" TIMESTAMP(3),
    "sharingStartedAt" TIMESTAMP(3),
    "lastLatitude" DOUBLE PRECISION,
    "lastLongitude" DOUBLE PRECISION,
    "lastAccuracyMetres" DOUBLE PRECISION,
    "lastLocationAt" TIMESTAMP(3),
    "lastPositionWriteAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LogisticsV1Shipment_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "LogisticsV1Shipment_status_check" CHECK ("status" IN ('ASSIGNED','ACCEPTED','PICKED_UP','IN_TRANSIT','DELIVERED','CANCELLED'))
);
CREATE UNIQUE INDEX "LogisticsV1Shipment_dealId_key" ON "LogisticsV1Shipment"("dealId");
CREATE INDEX "LogisticsV1Shipment_driverId_status_createdAt_idx" ON "LogisticsV1Shipment"("driverId", "status", "createdAt");
CREATE INDEX "LogisticsV1Shipment_buyerId_createdAt_idx" ON "LogisticsV1Shipment"("buyerId", "createdAt");
CREATE INDEX "LogisticsV1Shipment_sellerId_createdAt_idx" ON "LogisticsV1Shipment"("sellerId", "createdAt");
ALTER TABLE "LogisticsV1Shipment" ADD CONSTRAINT "LogisticsV1Shipment_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LogisticsV1Shipment" ADD CONSTRAINT "LogisticsV1Shipment_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LogisticsV1Shipment" ADD CONSTRAINT "LogisticsV1Shipment_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LogisticsV1Shipment" ADD CONSTRAINT "LogisticsV1Shipment_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LogisticsV1Shipment" ENABLE ROW LEVEL SECURITY;
-- Prisma queries run server-side as database-owner role; do NOT expose
-- location records to 'anon' or 'authenticated' through Supabase Data API.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN
    REVOKE ALL ON TABLE "LogisticsV1Shipment" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN
    REVOKE ALL ON TABLE "LogisticsV1Shipment" FROM authenticated;
  END IF;
END;
$$;
