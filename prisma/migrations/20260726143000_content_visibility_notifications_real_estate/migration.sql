-- Expand notifications into actionable buckets and add property listing verification data.
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'NEW_MESSAGE';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'MESSAGE_REQUEST_RECEIVED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'OPPORTUNITY_RESPONSE';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'PROPOSAL_UPDATE';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'DEAL_UPDATE';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'MODERATION_UPDATE';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'SUPPORT_REPLY';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'CONNECTION_REQUEST_RECEIVED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'CONNECTION_REQUEST_ACCEPTED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'CONNECTION_REQUEST_DECLINED';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PropertyVerificationState') THEN
    CREATE TYPE "PropertyVerificationState" AS ENUM (
      'DRAFT',
      'PENDING_VERIFICATION',
      'VERIFIED',
      'PUBLISHED',
      'REJECTED',
      'PAUSED',
      'ARCHIVED'
    );
  END IF;
END $$;

ALTER TABLE "Opportunity"
  ADD COLUMN IF NOT EXISTS "propertyVerificationState" "PropertyVerificationState",
  ADD COLUMN IF NOT EXISTS "propertyType" TEXT,
  ADD COLUMN IF NOT EXISTS "propertyListingType" TEXT,
  ADD COLUMN IF NOT EXISTS "contactPreference" TEXT,
  ADD COLUMN IF NOT EXISTS "authorityDeclaration" TEXT,
  ADD COLUMN IF NOT EXISTS "listingRulesAccepted" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "verificationNotes" TEXT;

CREATE TABLE IF NOT EXISTS "OpportunityImage" (
  "id" TEXT NOT NULL,
  "opportunityId" TEXT NOT NULL,
  "uploaderId" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "storageKey" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "byteSize" INTEGER NOT NULL,
  "altText" TEXT,
  "isCover" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OpportunityImage_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'OpportunityImage_opportunityId_fkey'
  ) THEN
    ALTER TABLE "OpportunityImage"
      ADD CONSTRAINT "OpportunityImage_opportunityId_fkey"
      FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "Notification"
  ADD COLUMN IF NOT EXISTS "actionUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "metadata" JSONB;

CREATE INDEX IF NOT EXISTS "Opportunity_type_status_moderationStatus_publishedAt_idx" ON "Opportunity"("type", "status", "moderationStatus", "publishedAt");
CREATE INDEX IF NOT EXISTS "Opportunity_propertyVerificationState_idx" ON "Opportunity"("propertyVerificationState");
CREATE INDEX IF NOT EXISTS "OpportunityImage_opportunityId_idx" ON "OpportunityImage"("opportunityId");
CREATE INDEX IF NOT EXISTS "OpportunityImage_uploaderId_idx" ON "OpportunityImage"("uploaderId");
CREATE INDEX IF NOT EXISTS "OpportunityImage_opportunityId_isCover_idx" ON "OpportunityImage"("opportunityId", "isCover");
CREATE INDEX IF NOT EXISTS "Notification_userId_type_createdAt_idx" ON "Notification"("userId", "type", "createdAt");
