-- Moderation cases, account enforcement, Master Admin role, and user restrictions.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum
    WHERE enumlabel = 'MASTER_ADMIN'
      AND enumtypid = '"RoleName"'::regtype
  ) THEN
    ALTER TYPE "RoleName" ADD VALUE 'MASTER_ADMIN';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ModerationCaseStatus') THEN
    CREATE TYPE "ModerationCaseStatus" AS ENUM (
      'NEW',
      'TRIAGED',
      'ASSIGNED',
      'IN_REVIEW',
      'NEEDS_INFORMATION',
      'ACTION_REQUIRED',
      'ESCALATED',
      'RESOLVED',
      'DISMISSED',
      'APPEALED',
      'CLOSED'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ModerationCaseSource') THEN
    CREATE TYPE "ModerationCaseSource" AS ENUM (
      'USER_REPORT',
      'MESSAGE_REPORT',
      'CONVERSATION_REPORT',
      'LISTING_REPORT',
      'DEAL_DISPUTE',
      'POLICY_FLAG',
      'SUPPORT_CASE',
      'SECURITY_INVESTIGATION'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EnforcementActionType') THEN
    CREATE TYPE "EnforcementActionType" AS ENUM (
      'WARNING',
      'MESSAGING_RESTRICTION',
      'CONNECTION_REQUEST_RESTRICTION',
      'PUBLISHING_RESTRICTION',
      'VERIFICATION_REQUIRED',
      'TEMPORARY_SUSPENSION',
      'INDEFINITE_SUSPENSION',
      'DEACTIVATION',
      'PERMANENT_BAN',
      'SESSION_REVOCATION',
      'RESTORATION'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EnforcementActionStatus') THEN
    CREATE TYPE "EnforcementActionStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'REVERSED');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EnforcementAppealStatus') THEN
    CREATE TYPE "EnforcementAppealStatus" AS ENUM (
      'SUBMITTED',
      'IN_REVIEW',
      'UPHELD',
      'MODIFIED',
      'REVERSED',
      'DISMISSED'
    );
  END IF;
END $$;

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "messagingRestrictedUntil" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "connectionRequestsRestrictedUntil" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "publishingRestrictedUntil" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "suspendedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "suspendedUntil" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "deactivatedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "bannedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "enforcementReasonPublic" TEXT,
  ADD COLUMN IF NOT EXISTS "onboardingDismissedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "User_messagingRestrictedUntil_idx" ON "User"("messagingRestrictedUntil");
CREATE INDEX IF NOT EXISTS "User_connectionRequestsRestrictedUntil_idx" ON "User"("connectionRequestsRestrictedUntil");
CREATE INDEX IF NOT EXISTS "User_publishingRestrictedUntil_idx" ON "User"("publishingRestrictedUntil");
CREATE INDEX IF NOT EXISTS "User_suspendedUntil_idx" ON "User"("suspendedUntil");
CREATE INDEX IF NOT EXISTS "User_bannedAt_idx" ON "User"("bannedAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'BlockedUser_blockerUserId_fkey'
  ) THEN
    ALTER TABLE "BlockedUser"
      ADD CONSTRAINT "BlockedUser_blockerUserId_fkey"
      FOREIGN KEY ("blockerUserId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'BlockedUser_blockedUserId_fkey'
  ) THEN
    ALTER TABLE "BlockedUser"
      ADD CONSTRAINT "BlockedUser_blockedUserId_fkey"
      FOREIGN KEY ("blockedUserId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "ModerationCase" (
  "id" TEXT NOT NULL,
  "source" "ModerationCaseSource" NOT NULL,
  "status" "ModerationCaseStatus" NOT NULL DEFAULT 'NEW',
  "priority" TEXT NOT NULL DEFAULT 'NORMAL',
  "category" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "targetType" TEXT NOT NULL,
  "targetId" TEXT NOT NULL,
  "reporterId" TEXT,
  "reportedUserId" TEXT,
  "assignedAdminId" TEXT,
  "linkedReportId" TEXT,
  "linkedOpportunityReportId" TEXT,
  "conversationId" TEXT,
  "messageId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ModerationCase_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ModerationCase_linkedReportId_fkey'
  ) THEN
    ALTER TABLE "ModerationCase"
      ADD CONSTRAINT "ModerationCase_linkedReportId_fkey"
      FOREIGN KEY ("linkedReportId") REFERENCES "UserReport"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "ModerationCase_status_createdAt_idx" ON "ModerationCase"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "ModerationCase_source_status_idx" ON "ModerationCase"("source", "status");
CREATE INDEX IF NOT EXISTS "ModerationCase_targetType_targetId_idx" ON "ModerationCase"("targetType", "targetId");
CREATE INDEX IF NOT EXISTS "ModerationCase_conversationId_idx" ON "ModerationCase"("conversationId");
CREATE INDEX IF NOT EXISTS "ModerationCase_assignedAdminId_status_idx" ON "ModerationCase"("assignedAdminId", "status");
CREATE INDEX IF NOT EXISTS "ModerationCase_linkedReportId_idx" ON "ModerationCase"("linkedReportId");

CREATE TABLE IF NOT EXISTS "ModerationCaseEvent" (
  "id" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "actorId" TEXT,
  "type" TEXT NOT NULL,
  "reason" TEXT,
  "note" TEXT,
  "previousStatus" "ModerationCaseStatus",
  "nextStatus" "ModerationCaseStatus",
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ModerationCaseEvent_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ModerationCaseEvent_caseId_fkey'
  ) THEN
    ALTER TABLE "ModerationCaseEvent"
      ADD CONSTRAINT "ModerationCaseEvent_caseId_fkey"
      FOREIGN KEY ("caseId") REFERENCES "ModerationCase"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "ModerationCaseEvent_caseId_createdAt_idx" ON "ModerationCaseEvent"("caseId", "createdAt");
CREATE INDEX IF NOT EXISTS "ModerationCaseEvent_actorId_createdAt_idx" ON "ModerationCaseEvent"("actorId", "createdAt");
CREATE INDEX IF NOT EXISTS "ModerationCaseEvent_type_createdAt_idx" ON "ModerationCaseEvent"("type", "createdAt");

CREATE TABLE IF NOT EXISTS "ModerationMessageScope" (
  "id" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "messageId" TEXT,
  "revealedById" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "timeRangeStart" TIMESTAMP(3),
  "timeRangeEnd" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ModerationMessageScope_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ModerationMessageScope_caseId_fkey'
  ) THEN
    ALTER TABLE "ModerationMessageScope"
      ADD CONSTRAINT "ModerationMessageScope_caseId_fkey"
      FOREIGN KEY ("caseId") REFERENCES "ModerationCase"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "ModerationMessageScope_caseId_createdAt_idx" ON "ModerationMessageScope"("caseId", "createdAt");
CREATE INDEX IF NOT EXISTS "ModerationMessageScope_conversationId_createdAt_idx" ON "ModerationMessageScope"("conversationId", "createdAt");
CREATE INDEX IF NOT EXISTS "ModerationMessageScope_revealedById_createdAt_idx" ON "ModerationMessageScope"("revealedById", "createdAt");

CREATE TABLE IF NOT EXISTS "EnforcementAction" (
  "id" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "targetUserId" TEXT NOT NULL,
  "type" "EnforcementActionType" NOT NULL,
  "status" "EnforcementActionStatus" NOT NULL DEFAULT 'ACTIVE',
  "reason" TEXT NOT NULL,
  "userFacingExplanation" TEXT NOT NULL,
  "internalNote" TEXT NOT NULL,
  "previousState" JSONB,
  "newState" JSONB,
  "expiresAt" TIMESTAMP(3),
  "appealAllowed" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EnforcementAction_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'EnforcementAction_caseId_fkey'
  ) THEN
    ALTER TABLE "EnforcementAction"
      ADD CONSTRAINT "EnforcementAction_caseId_fkey"
      FOREIGN KEY ("caseId") REFERENCES "ModerationCase"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "EnforcementAction_caseId_createdAt_idx" ON "EnforcementAction"("caseId", "createdAt");
CREATE INDEX IF NOT EXISTS "EnforcementAction_targetUserId_status_idx" ON "EnforcementAction"("targetUserId", "status");
CREATE INDEX IF NOT EXISTS "EnforcementAction_type_status_idx" ON "EnforcementAction"("type", "status");
CREATE INDEX IF NOT EXISTS "EnforcementAction_expiresAt_idx" ON "EnforcementAction"("expiresAt");

CREATE TABLE IF NOT EXISTS "EnforcementAppeal" (
  "id" TEXT NOT NULL,
  "enforcementActionId" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "appellantId" TEXT NOT NULL,
  "reviewerId" TEXT,
  "status" "EnforcementAppealStatus" NOT NULL DEFAULT 'SUBMITTED',
  "body" TEXT NOT NULL,
  "resolution" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EnforcementAppeal_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'EnforcementAppeal_enforcementActionId_fkey'
  ) THEN
    ALTER TABLE "EnforcementAppeal"
      ADD CONSTRAINT "EnforcementAppeal_enforcementActionId_fkey"
      FOREIGN KEY ("enforcementActionId") REFERENCES "EnforcementAction"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'EnforcementAppeal_caseId_fkey'
  ) THEN
    ALTER TABLE "EnforcementAppeal"
      ADD CONSTRAINT "EnforcementAppeal_caseId_fkey"
      FOREIGN KEY ("caseId") REFERENCES "ModerationCase"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "EnforcementAppeal_appellantId_status_createdAt_idx" ON "EnforcementAppeal"("appellantId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "EnforcementAppeal_caseId_status_idx" ON "EnforcementAppeal"("caseId", "status");
CREATE INDEX IF NOT EXISTS "EnforcementAppeal_enforcementActionId_idx" ON "EnforcementAppeal"("enforcementActionId");

INSERT INTO "Role" ("id", "name", "label", "description")
VALUES (
  'role_master_admin',
  'MASTER_ADMIN',
  'Master Admin',
  'Reason-required access to PerX administration, cases, enforcement, trust configuration, broadcasts, audit logs, and session revocation.'
)
ON CONFLICT ("name") DO UPDATE SET
  "label" = EXCLUDED."label",
  "description" = EXCLUDED."description";

INSERT INTO "UserRole" ("id", "userId", "roleId")
SELECT
  'userrole_master_admin_cmrw0tjql000004lb02rg24d0',
  u."id",
  r."id"
FROM "User" u
JOIN "Role" r ON r."name" = 'MASTER_ADMIN'
WHERE u."id" = 'cmrw0tjql000004lb02rg24d0'
ON CONFLICT ("userId", "roleId") DO NOTHING;
