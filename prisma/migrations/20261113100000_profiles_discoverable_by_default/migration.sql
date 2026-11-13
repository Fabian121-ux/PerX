-- Public member profiles are discoverable by default, including incomplete profiles.
-- Members can opt out at any time using the profile privacy setting.
ALTER TABLE "Profile"
  ALTER COLUMN "isDiscoverable" SET DEFAULT true;

-- The previous privacy-default migration marked placeholder profiles private.
-- Restore discoverability for active public beta accounts; explicit future opt-outs
-- remain respected because this update runs only as a one-time migration.
UPDATE "Profile" AS p
SET
  "isDiscoverable" = true,
  "updatedAt" = CURRENT_TIMESTAMP
FROM "User" AS u
WHERE p."userId" = u."id"
  AND u."accountClassification" = 'PUBLIC_BETA_USER'
  AND u."isActive" = true
  AND u."deactivatedAt" IS NULL
  AND u."bannedAt" IS NULL;
