-- Realtime is consumed only by the server, which authorizes each SSE client
-- before opening a conversation-scoped subscription.
ALTER TABLE public."Message" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ConversationEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ConversationParticipant" ENABLE ROW LEVEL SECURITY;

-- These tables contain private conversation data. Browser-key roles have no
-- direct table access; the server-side service role bypasses RLS after the app
-- has authorized the SSE request.
DO $$
BEGIN
  EXECUTE 'REVOKE ALL ON TABLE public."Message", public."ConversationEvent", public."ConversationParticipant" FROM PUBLIC';
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON TABLE public."Message", public."ConversationEvent", public."ConversationParticipant" FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON TABLE public."Message", public."ConversationEvent", public."ConversationParticipant" FROM authenticated';
  END IF;
END $$;

-- Participant UPDATE payloads need the previous removedAt value so the server
-- can restart subscriptions only when membership actually changes. Message
-- rows are retained as tombstones by product actions rather than hard-deleted.
ALTER TABLE public."Message" REPLICA IDENTITY FULL;
ALTER TABLE public."ConversationParticipant" REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'Message'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public."Message";
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'ConversationEvent'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public."ConversationEvent";
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'ConversationParticipant'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public."ConversationParticipant";
    END IF;

  END IF;
END $$;
