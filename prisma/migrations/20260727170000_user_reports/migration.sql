CREATE TYPE "UserReportTargetType" AS ENUM (
  'MESSAGE',
  'CONVERSATION',
  'USER',
  'OPPORTUNITY',
  'DEAL',
  'REVIEW',
  'REAL_ESTATE_LISTING',
  'OTHER_CONTENT'
);

CREATE TYPE "UserReportStatus" AS ENUM (
  'SUBMITTED',
  'IN_REVIEW',
  'ACTION_TAKEN',
  'RESOLVED',
  'DISMISSED'
);

CREATE TABLE "UserReport" (
  "id" TEXT NOT NULL,
  "reporterId" TEXT NOT NULL,
  "targetType" "UserReportTargetType" NOT NULL,
  "targetId" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "details" TEXT,
  "status" "UserReportStatus" NOT NULL DEFAULT 'SUBMITTED',
  "contextConversationId" TEXT,
  "contextMessageId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "UserReport_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "UserReport"
  ADD CONSTRAINT "UserReport_reporterId_fkey"
  FOREIGN KEY ("reporterId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "UserReport_reporterId_targetType_targetId_status_key"
  ON "UserReport"("reporterId", "targetType", "targetId", "status");

CREATE INDEX "UserReport_reporterId_status_createdAt_idx"
  ON "UserReport"("reporterId", "status", "createdAt");

CREATE INDEX "UserReport_targetType_targetId_idx"
  ON "UserReport"("targetType", "targetId");

CREATE INDEX "UserReport_status_createdAt_idx"
  ON "UserReport"("status", "createdAt");

CREATE INDEX "UserReport_category_status_idx"
  ON "UserReport"("category", "status");
