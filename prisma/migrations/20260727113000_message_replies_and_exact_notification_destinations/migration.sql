-- Add reply-to-message support and repair legacy message notification destinations.
ALTER TABLE "Message"
  ADD COLUMN IF NOT EXISTS "replyToMessageId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Message_replyToMessageId_fkey'
  ) THEN
    ALTER TABLE "Message"
      ADD CONSTRAINT "Message_replyToMessageId_fkey"
      FOREIGN KEY ("replyToMessageId") REFERENCES "Message"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Message_replyToMessageId_idx" ON "Message"("replyToMessageId");

WITH candidates AS (
  SELECT
    n."id" AS "notificationId",
    m."conversationId",
    m."id" AS "messageId",
    m."senderId"
  FROM "Notification" n
  JOIN LATERAL (
    SELECT m.*
    FROM "Message" m
    JOIN "ConversationParticipant" cp
      ON cp."conversationId" = m."conversationId"
      AND cp."userId" = n."userId"
    WHERE
      n."type" IN ('MESSAGE', 'NEW_MESSAGE')
      AND m."senderId" <> n."userId"
      AND (
        (
          n."metadata" IS NOT NULL
          AND n."metadata"->>'conversationId' IS NOT NULL
          AND m."conversationId" = n."metadata"->>'conversationId'
        )
        OR (
          n."actionUrl" ~ '^/app/messages/[^?]+$'
          AND m."conversationId" = regexp_replace(n."actionUrl", '^/app/messages/', '')
        )
      )
      AND m."createdAt" <= n."createdAt" + interval '5 minutes'
    ORDER BY ABS(EXTRACT(EPOCH FROM (n."createdAt" - m."createdAt"))) ASC
    LIMIT 1
  ) m ON true
  WHERE
    n."type" IN ('MESSAGE', 'NEW_MESSAGE')
    AND (
      n."actionUrl" IS NULL
      OR n."actionUrl" !~ '^/app/messages/[^?]+[?]message='
      OR n."metadata"->>'messageId' IS NULL
    )
)
UPDATE "Notification" n
SET
  "actionUrl" = '/app/messages/' || candidates."conversationId" || '?message=' || candidates."messageId",
  "metadata" = COALESCE(n."metadata", '{}'::jsonb) || jsonb_build_object(
    'conversationId', candidates."conversationId",
    'messageId', candidates."messageId",
    'senderId', candidates."senderId"
  )
FROM candidates
WHERE n."id" = candidates."notificationId";
