CREATE INDEX CONCURRENTLY IF NOT EXISTS "AuditLog_entityType_action_createdAt_id_idx"
ON "AuditLog"("entityType", "action", "createdAt", "id");
