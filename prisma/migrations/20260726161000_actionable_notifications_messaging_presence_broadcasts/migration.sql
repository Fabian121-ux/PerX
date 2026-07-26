-- Actionable notifications, message edits, presence privacy, and admin broadcasts.
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'BROADCAST';

ALTER TABLE "Profile"
  ADD COLUMN IF NOT EXISTS "showPresence" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "showLastActiveTime" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Message"
  ADD COLUMN IF NOT EXISTS "editedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "deletedById" TEXT;

CREATE TABLE IF NOT EXISTS "MessageEdit" (
  "id" TEXT NOT NULL,
  "messageId" TEXT NOT NULL,
  "editorId" TEXT NOT NULL,
  "previousBodyHash" TEXT NOT NULL,
  "nextBodyHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MessageEdit_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'MessageEdit_messageId_fkey'
  ) THEN
    ALTER TABLE "MessageEdit"
      ADD CONSTRAINT "MessageEdit_messageId_fkey"
      FOREIGN KEY ("messageId") REFERENCES "Message"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "AdminBroadcast" (
  "id" TEXT NOT NULL,
  "senderId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "audience" TEXT NOT NULL,
  "priority" TEXT NOT NULL DEFAULT 'NORMAL',
  "actionUrl" TEXT,
  "expiresAt" TIMESTAMP(3),
  "deliveryCount" INTEGER NOT NULL DEFAULT 0,
  "failedCount" INTEGER NOT NULL DEFAULT 0,
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminBroadcast_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "BroadcastDelivery" (
  "id" TEXT NOT NULL,
  "broadcastId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "notificationId" TEXT,
  "status" TEXT NOT NULL,
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BroadcastDelivery_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'BroadcastDelivery_broadcastId_fkey'
  ) THEN
    ALTER TABLE "BroadcastDelivery"
      ADD CONSTRAINT "BroadcastDelivery_broadcastId_fkey"
      FOREIGN KEY ("broadcastId") REFERENCES "AdminBroadcast"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "Notification"
  ADD COLUMN IF NOT EXISTS "actionState" TEXT,
  ADD COLUMN IF NOT EXISTS "broadcastId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Notification_broadcastId_fkey'
  ) THEN
    ALTER TABLE "Notification"
      ADD CONSTRAINT "Notification_broadcastId_fkey"
      FOREIGN KEY ("broadcastId") REFERENCES "AdminBroadcast"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Message_senderId_createdAt_idx" ON "Message"("senderId", "createdAt");
CREATE INDEX IF NOT EXISTS "Message_editedAt_idx" ON "Message"("editedAt");
CREATE INDEX IF NOT EXISTS "MessageEdit_messageId_createdAt_idx" ON "MessageEdit"("messageId", "createdAt");
CREATE INDEX IF NOT EXISTS "MessageEdit_editorId_createdAt_idx" ON "MessageEdit"("editorId", "createdAt");
CREATE INDEX IF NOT EXISTS "AdminBroadcast_senderId_createdAt_idx" ON "AdminBroadcast"("senderId", "createdAt");
CREATE INDEX IF NOT EXISTS "AdminBroadcast_audience_createdAt_idx" ON "AdminBroadcast"("audience", "createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "BroadcastDelivery_broadcastId_userId_key" ON "BroadcastDelivery"("broadcastId", "userId");
CREATE INDEX IF NOT EXISTS "BroadcastDelivery_userId_createdAt_idx" ON "BroadcastDelivery"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "BroadcastDelivery_status_createdAt_idx" ON "BroadcastDelivery"("status", "createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "Notification_userId_broadcastId_key" ON "Notification"("userId", "broadcastId");
CREATE INDEX IF NOT EXISTS "Notification_broadcastId_idx" ON "Notification"("broadcastId");
