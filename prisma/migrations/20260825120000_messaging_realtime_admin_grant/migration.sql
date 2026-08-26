-- Restore the SELECT that Supabase Realtime needs to register FILTERED
-- postgres_changes subscriptions on the messaging tables.
--
-- Why this is required
-- -------------------
-- `20260824120000_messaging_realtime_publication` revokes all privileges on
-- the messaging tables from PUBLIC/anon/authenticated, and `service_role` held
-- its access through those grants. Realtime validates a subscription filter as
-- the SUBSCRIBER's role - the role in the connecting JWT, which for this
-- server-only transport is `service_role` - so the revoke silently removed the
-- read access Realtime needs to accept a filtered subscription.
--
-- The failure mode is silent and easy to misread: `subscribe()` still reports
-- SUBSCRIBED, but the subscription is never registered in
-- `realtime.subscription` and no change events are ever delivered. Unfiltered
-- subscriptions keep working, so only the conversation-scoped filters the
-- server actually uses are affected.
--
-- Verified against a local Supabase stack: without this grant a filtered
-- subscription registers 0 rows and receives 0 of 10 committed inserts; with
-- it, the subscription registers and delivers every change.
--
-- This does NOT give browser keys access. `anon` and `authenticated` remain
-- revoked, RLS stays enabled on all three tables, and the server still
-- authorizes every SSE client before opening a conversation-scoped
-- subscription. `service_role` is server-only and never sent to a browser.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    EXECUTE 'GRANT SELECT ON TABLE public."Message", public."ConversationEvent", public."ConversationParticipant" TO service_role';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_realtime_admin') THEN
    EXECUTE 'GRANT SELECT ON TABLE public."Message", public."ConversationEvent", public."ConversationParticipant" TO supabase_realtime_admin';
  END IF;
END $$;
