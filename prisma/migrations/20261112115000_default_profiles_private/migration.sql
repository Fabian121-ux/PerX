-- Preserve existing member privacy choices while transitioning the default.
-- The following migration restores the product default to discoverable.
ALTER TABLE "Profile"
  ALTER COLUMN "isDiscoverable" SET DEFAULT false;
