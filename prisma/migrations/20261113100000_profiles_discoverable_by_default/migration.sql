-- Public member profiles are discoverable by default, including incomplete profiles.
-- Existing per-member privacy choices are preserved; only the default for new
-- profiles changes. Members can opt out at any time in profile privacy settings.
ALTER TABLE "Profile"
  ALTER COLUMN "isDiscoverable" SET DEFAULT true;
