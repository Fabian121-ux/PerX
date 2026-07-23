-- Add safer connection lifecycle and profile discovery/privacy controls.
ALTER TYPE "ConnectionStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "imageStorageKey" TEXT;

ALTER TABLE "Profile"
  ADD COLUMN IF NOT EXISTS "profileImageStorageKey" TEXT,
  ADD COLUMN IF NOT EXISTS "isDiscoverable" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "showLocation" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "showSkills" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "allowConnectionRequests" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "allowMessagesFromConnections" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "allowMessagesFromMembers" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "User_isActive_accountClassification_idx" ON "User"("isActive", "accountClassification");
CREATE INDEX IF NOT EXISTS "Profile_isDiscoverable_updatedAt_idx" ON "Profile"("isDiscoverable", "updatedAt");
CREATE INDEX IF NOT EXISTS "Profile_location_idx" ON "Profile"("location");
CREATE INDEX IF NOT EXISTS "ProfileSkill_name_idx" ON "ProfileSkill"("name");
CREATE INDEX IF NOT EXISTS "Opportunity_ownerId_status_updatedAt_idx" ON "Opportunity"("ownerId", "status", "updatedAt");
CREATE INDEX IF NOT EXISTS "Conversation_updatedAt_idx" ON "Conversation"("updatedAt");
CREATE INDEX IF NOT EXISTS "ConversationParticipant_conversationId_idx" ON "ConversationParticipant"("conversationId");
CREATE INDEX IF NOT EXISTS "ConversationParticipant_userId_lastReadAt_idx" ON "ConversationParticipant"("userId", "lastReadAt");
CREATE INDEX IF NOT EXISTS "MessageReadReceipt_userId_readAt_idx" ON "MessageReadReceipt"("userId", "readAt");
CREATE INDEX IF NOT EXISTS "BlockedUser_blockerUserId_idx" ON "BlockedUser"("blockerUserId");
CREATE INDEX IF NOT EXISTS "BlockedUser_blockedUserId_idx" ON "BlockedUser"("blockedUserId");
CREATE INDEX IF NOT EXISTS "Connection_requesterId_status_idx" ON "Connection"("requesterId", "status");
CREATE INDEX IF NOT EXISTS "Connection_receiverId_status_idx" ON "Connection"("receiverId", "status");
CREATE INDEX IF NOT EXISTS "Connection_status_idx" ON "Connection"("status");
