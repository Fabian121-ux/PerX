-- AUTH-SUPABASE-1 foundation: link the existing PtahX application user record
-- to Supabase Auth without replacing the application's text/cuid primary key.
--
-- Nullable for incremental cutover: existing application users remain intact
-- until a Supabase Auth identity is explicitly established and linked.
-- Legacy password/session columns are intentionally retained for rollback.
ALTER TABLE "User" ADD COLUMN "authUserId" UUID;

-- PostgreSQL UNIQUE permits multiple NULL values, so legacy/unmigrated users can
-- coexist while every linked Supabase Auth identity maps to at most one PtahX user.
CREATE UNIQUE INDEX "User_authUserId_key" ON "User"("authUserId");
