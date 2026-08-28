-- Trader access applications.
--
-- Creation access was previously reachable only by self-assigning a role at
-- /app/roles, which any authenticated user could do. This introduces an
-- explicit, reviewable application so the grant is attributable.
--
-- Scope note: this migration contains ONLY the new enums, table and indexes.
-- `prisma migrate dev` also proposes unrelated `updatedAt` default drops and
-- foreign-key renames on Deal/Approval/Release/Enforcement/Moderation. That is
-- pre-existing baseline drift, unrelated to trader access, so it is not
-- bundled here.
CREATE TYPE "TraderApplicationStatus" AS ENUM (
  'DRAFT',
  'PENDING_REVIEW',
  'NEEDS_CHANGES',
  'APPROVED',
  'REJECTED',
  'SUSPENDED'
);

CREATE TYPE "TraderApplicantKind" AS ENUM ('INDIVIDUAL', 'BUSINESS');

CREATE TABLE "TraderApplication" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "TraderApplicationStatus" NOT NULL DEFAULT 'DRAFT',
    "applicantKind" "TraderApplicantKind" NOT NULL DEFAULT 'INDIVIDUAL',
    "tradeCategory" TEXT NOT NULL,
    "headline" TEXT NOT NULL,
    "experience" TEXT NOT NULL,
    "reviewerId" TEXT,
    "reviewerNote" TEXT,
    "submittedAt" TIMESTAMP(3),
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TraderApplication_pkey" PRIMARY KEY ("id")
);

-- One application per user: re-applying updates the existing record so review
-- history stays in one place.
CREATE UNIQUE INDEX "TraderApplication_userId_key" ON "TraderApplication"("userId");

-- Supports the admin review queue, which lists pending applications oldest first.
CREATE INDEX "TraderApplication_status_submittedAt_idx" ON "TraderApplication"("status", "submittedAt");

ALTER TABLE "TraderApplication" ADD CONSTRAINT "TraderApplication_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
