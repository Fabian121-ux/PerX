-- New accounts must explicitly opt into people discovery after completing a profile.
ALTER TABLE "Profile"
  ALTER COLUMN "isDiscoverable" SET DEFAULT false;

-- Existing pending and placeholder profiles should not be listed as recommendations.
UPDATE "Profile" AS p
SET
  "isDiscoverable" = false,
  "updatedAt" = CURRENT_TIMESTAMP
FROM "User" AS u
WHERE p."userId" = u."id"
  AND (
    u."emailVerifiedAt" IS NULL
    OR u."verificationStatus" <> 'VERIFIED'
    OR p."profileCompleteness" < 50
    OR p."headline" = 'New PtahX member'
    OR p."biography" = 'Profile setup is in progress.'
  );
