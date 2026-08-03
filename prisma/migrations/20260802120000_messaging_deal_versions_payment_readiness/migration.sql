-- Additive messaging and immutable Deal-term foundations.
CREATE TYPE "ProposalVersionStatus" AS ENUM (
  'DRAFT',
  'SUBMITTED',
  'SUPERSEDED',
  'ACCEPTED',
  'REJECTED',
  'WITHDRAWN',
  'EXPIRED'
);

CREATE TYPE "ConversationEventType" AS ENUM (
  'PROPOSAL_SUBMITTED',
  'PROPOSAL_OBJECTION_RAISED',
  'PROPOSAL_REVISION_CREATED',
  'PROPOSAL_REVISION_SUBMITTED',
  'PROPOSAL_ACCEPTED',
  'PROPOSAL_REJECTED',
  'DEAL_CREATED',
  'DEAL_STATUS_CHANGED',
  'MILESTONE_SUBMITTED',
  'MILESTONE_APPROVED',
  'SIMULATED_RELEASE_RECORDED'
);

CREATE TYPE "DealSettlementMode" AS ENUM ('SIMULATED', 'PROVIDER_DISABLED');

ALTER TABLE "ConversationParticipant"
ADD COLUMN "removedAt" TIMESTAMP(3);

CREATE TABLE "ProposalVersion" (
  "id" TEXT NOT NULL,
  "proposalId" TEXT NOT NULL,
  "versionNumber" INTEGER NOT NULL,
  "status" "ProposalVersionStatus" NOT NULL DEFAULT 'DRAFT',
  "amountMinor" BIGINT NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'NGN',
  "description" TEXT NOT NULL,
  "deliveryDays" INTEGER NOT NULL,
  "includedRevisions" INTEGER NOT NULL DEFAULT 1,
  "createdById" TEXT NOT NULL,
  "supersedesVersionId" TEXT,
  "submittedAt" TIMESTAMP(3),
  "acceptedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProposalVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProposalVersionMilestone" (
  "id" TEXT NOT NULL,
  "proposalVersionId" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "amountMinor" BIGINT NOT NULL,
  "dueInDays" INTEGER NOT NULL,
  CONSTRAINT "ProposalVersionMilestone_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ConversationEvent" (
  "id" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "actorId" TEXT,
  "type" "ConversationEventType" NOT NULL,
  "proposalVersionId" TEXT,
  "dealId" TEXT,
  "snapshot" JSONB NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ConversationEvent_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Deal"
ADD COLUMN "proposalVersionId" TEXT,
ADD COLUMN "settlementMode" "DealSettlementMode" NOT NULL DEFAULT 'SIMULATED';

ALTER TABLE "Approval" ADD COLUMN "milestoneId" TEXT;
ALTER TABLE "Release" ADD COLUMN "milestoneId" TEXT;

INSERT INTO "ProposalVersion" (
  "id",
  "proposalId",
  "versionNumber",
  "status",
  "amountMinor",
  "currency",
  "description",
  "deliveryDays",
  "includedRevisions",
  "createdById",
  "submittedAt",
  "acceptedAt",
  "createdAt",
  "updatedAt"
)
SELECT
  'legacy_pv_' || substr(md5(p."id" || ':' || random()::text), 1, 22),
  p."id",
  1,
  CASE p."status"::text
    WHEN 'DRAFT' THEN 'DRAFT'::"ProposalVersionStatus"
    WHEN 'ACCEPTED' THEN 'ACCEPTED'::"ProposalVersionStatus"
    WHEN 'REJECTED' THEN 'REJECTED'::"ProposalVersionStatus"
    WHEN 'WITHDRAWN' THEN 'WITHDRAWN'::"ProposalVersionStatus"
    WHEN 'COUNTERED' THEN 'SUBMITTED'::"ProposalVersionStatus"
    WHEN 'EXPIRED' THEN 'EXPIRED'::"ProposalVersionStatus"
    ELSE 'SUBMITTED'::"ProposalVersionStatus"
  END,
  p."amountMinor",
  p."currency",
  p."description",
  p."deliveryDays",
  p."revisions",
  p."senderId",
  CASE WHEN p."status"::text = 'DRAFT' THEN NULL ELSE p."createdAt" END,
  CASE WHEN p."status"::text = 'ACCEPTED' THEN p."updatedAt" ELSE NULL END,
  p."createdAt",
  p."updatedAt"
FROM "Proposal" p;

INSERT INTO "ProposalVersionMilestone" (
  "id",
  "proposalVersionId",
  "position",
  "title",
  "description",
  "amountMinor",
  "dueInDays"
)
SELECT
  'legacy_pvm_' || substr(md5(pm."id" || ':' || random()::text), 1, 21),
  pv."id",
  row_number() OVER (PARTITION BY pm."proposalId" ORDER BY pm."id")::integer,
  pm."title",
  pm."description",
  pm."amountMinor",
  pm."dueInDays"
FROM "ProposalMilestone" pm
JOIN "ProposalVersion" pv ON pv."proposalId" = pm."proposalId";

UPDATE "Deal" d
SET "proposalVersionId" = pv."id"
FROM "ProposalVersion" pv
WHERE pv."proposalId" = d."proposalId";

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Deal" WHERE "proposalVersionId" IS NULL) THEN
    RAISE EXCEPTION 'Cannot enforce Deal proposal versions: backfill left null references.';
  END IF;
END $$;

ALTER TABLE "Deal" ALTER COLUMN "proposalVersionId" SET NOT NULL;

CREATE UNIQUE INDEX "ProposalVersion_id_proposalId_key"
ON "ProposalVersion"("id", "proposalId");
CREATE UNIQUE INDEX "ProposalVersion_proposalId_versionNumber_key"
ON "ProposalVersion"("proposalId", "versionNumber");
CREATE UNIQUE INDEX "ProposalVersion_one_draft_per_proposal_key"
ON "ProposalVersion"("proposalId") WHERE "status" = 'DRAFT';
CREATE UNIQUE INDEX "ProposalVersion_one_submitted_per_proposal_key"
ON "ProposalVersion"("proposalId") WHERE "status" = 'SUBMITTED';
CREATE INDEX "ProposalVersion_proposalId_status_createdAt_idx"
ON "ProposalVersion"("proposalId", "status", "createdAt");
CREATE INDEX "ProposalVersion_supersedesVersionId_idx"
ON "ProposalVersion"("supersedesVersionId");
CREATE UNIQUE INDEX "ProposalVersionMilestone_proposalVersionId_position_key"
ON "ProposalVersionMilestone"("proposalVersionId", "position");
CREATE UNIQUE INDEX "ConversationEvent_idempotencyKey_key"
ON "ConversationEvent"("idempotencyKey");
CREATE INDEX "ConversationEvent_conversationId_createdAt_idx"
ON "ConversationEvent"("conversationId", "createdAt");
CREATE INDEX "ConversationEvent_proposalVersionId_idx"
ON "ConversationEvent"("proposalVersionId");
CREATE INDEX "ConversationEvent_dealId_idx"
ON "ConversationEvent"("dealId");
CREATE INDEX "ConversationParticipant_userId_removedAt_idx"
ON "ConversationParticipant"("userId", "removedAt");
CREATE UNIQUE INDEX "Deal_proposalVersionId_proposalId_key"
ON "Deal"("proposalVersionId", "proposalId");
CREATE UNIQUE INDEX "DealMilestone_id_dealId_key"
ON "DealMilestone"("id", "dealId");
CREATE INDEX "Approval_milestoneId_idx" ON "Approval"("milestoneId");
CREATE INDEX "Release_milestoneId_idx" ON "Release"("milestoneId");

ALTER TABLE "ProposalVersion"
ADD CONSTRAINT "ProposalVersion_proposalId_fkey"
FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProposalVersion"
ADD CONSTRAINT "ProposalVersion_supersedesVersionId_fkey"
FOREIGN KEY ("supersedesVersionId") REFERENCES "ProposalVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProposalVersionMilestone"
ADD CONSTRAINT "ProposalVersionMilestone_proposalVersionId_fkey"
FOREIGN KEY ("proposalVersionId") REFERENCES "ProposalVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConversationEvent"
ADD CONSTRAINT "ConversationEvent_conversationId_fkey"
FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ConversationEvent"
ADD CONSTRAINT "ConversationEvent_proposalVersionId_fkey"
FOREIGN KEY ("proposalVersionId") REFERENCES "ProposalVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ConversationEvent"
ADD CONSTRAINT "ConversationEvent_dealId_fkey"
FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Deal"
ADD CONSTRAINT "Deal_proposalVersionId_fkey"
FOREIGN KEY ("proposalVersionId", "proposalId") REFERENCES "ProposalVersion"("id", "proposalId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Approval"
ADD CONSTRAINT "Approval_milestoneId_fkey"
FOREIGN KEY ("milestoneId", "dealId") REFERENCES "DealMilestone"("id", "dealId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Release"
ADD CONSTRAINT "Release_milestoneId_fkey"
FOREIGN KEY ("milestoneId", "dealId") REFERENCES "DealMilestone"("id", "dealId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Deal" DROP CONSTRAINT "Deal_proposalId_fkey";
ALTER TABLE "Deal"
ADD CONSTRAINT "Deal_proposalId_fkey"
FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION "enforce_proposal_version_immutability"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD."status" <> 'DRAFT' THEN
      RAISE EXCEPTION 'Submitted proposal versions cannot be deleted.';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD."status" <> 'DRAFT' AND (
    NEW."proposalId" IS DISTINCT FROM OLD."proposalId" OR
    NEW."versionNumber" IS DISTINCT FROM OLD."versionNumber" OR
    NEW."amountMinor" IS DISTINCT FROM OLD."amountMinor" OR
    NEW."currency" IS DISTINCT FROM OLD."currency" OR
    NEW."description" IS DISTINCT FROM OLD."description" OR
    NEW."deliveryDays" IS DISTINCT FROM OLD."deliveryDays" OR
    NEW."includedRevisions" IS DISTINCT FROM OLD."includedRevisions" OR
    NEW."createdById" IS DISTINCT FROM OLD."createdById" OR
    NEW."supersedesVersionId" IS DISTINCT FROM OLD."supersedesVersionId"
  ) THEN
    RAISE EXCEPTION 'Submitted proposal version terms are immutable.';
  END IF;

  IF NEW."status" IS DISTINCT FROM OLD."status" AND NOT (
    (OLD."status" = 'DRAFT' AND NEW."status" IN ('SUBMITTED', 'WITHDRAWN')) OR
    (OLD."status" = 'SUBMITTED' AND NEW."status" IN ('SUPERSEDED', 'ACCEPTED', 'REJECTED', 'WITHDRAWN', 'EXPIRED'))
  ) THEN
    RAISE EXCEPTION 'Invalid proposal version status transition from % to %.', OLD."status", NEW."status";
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "ProposalVersion_immutable_terms"
BEFORE UPDATE OR DELETE ON "ProposalVersion"
FOR EACH ROW EXECUTE FUNCTION "enforce_proposal_version_immutability"();

CREATE FUNCTION "enforce_proposal_version_milestone_immutability"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  old_parent_status "ProposalVersionStatus";
  new_parent_status "ProposalVersionStatus";
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    SELECT "status" INTO old_parent_status
    FROM "ProposalVersion"
    WHERE "id" = OLD."proposalVersionId";
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    SELECT "status" INTO new_parent_status
    FROM "ProposalVersion"
    WHERE "id" = NEW."proposalVersionId";
  END IF;

  IF (old_parent_status IS NOT NULL AND old_parent_status <> 'DRAFT') OR
     (new_parent_status IS NOT NULL AND new_parent_status <> 'DRAFT') THEN
    RAISE EXCEPTION 'Submitted proposal version milestones are immutable.';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

CREATE TRIGGER "ProposalVersionMilestone_immutable_terms"
BEFORE INSERT OR UPDATE OR DELETE ON "ProposalVersionMilestone"
FOR EACH ROW EXECUTE FUNCTION "enforce_proposal_version_milestone_immutability"();
