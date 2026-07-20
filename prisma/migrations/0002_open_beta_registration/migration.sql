-- Add a minimal membership role and a separate account classification used for
-- beta-capacity accounting and internal account management.
ALTER TYPE "RoleName" ADD VALUE IF NOT EXISTS 'MEMBER';

CREATE TYPE "AccountClassification" AS ENUM (
  'PUBLIC_BETA_USER',
  'INTERNAL_TEST_USER',
  'INTERNAL_ADMIN',
  'SYSTEM_ACCOUNT'
);

ALTER TABLE "User"
ADD COLUMN "accountClassification" "AccountClassification" NOT NULL DEFAULT 'PUBLIC_BETA_USER';

CREATE INDEX "User_accountClassification_idx" ON "User"("accountClassification");
