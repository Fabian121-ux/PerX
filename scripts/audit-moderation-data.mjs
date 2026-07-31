import "dotenv/config";

import crypto from "node:crypto";
import { Client } from "pg";

const fix = process.argv.includes("--fix");
const confirmed =
  process.env.PERX_AUDIT_MODERATION_FIX_CONFIRM === "CREATE_MISSING_MODERATION_CASES";

if (fix && !confirmed) {
  throw new Error(
    "Set PERX_AUDIT_MODERATION_FIX_CONFIRM=CREATE_MISSING_MODERATION_CASES with --fix.",
  );
}

function sourceForTarget(targetType) {
  if (targetType === "MESSAGE") return "MESSAGE_REPORT";
  if (targetType === "CONVERSATION") return "CONVERSATION_REPORT";
  if (targetType === "DEAL") return "DEAL_DISPUTE";
  if (targetType === "OPPORTUNITY" || targetType === "REAL_ESTATE_LISTING") {
    return "LISTING_REPORT";
  }
  return "USER_REPORT";
}

function titleForReport(report) {
  return `${report.targetType.toLowerCase().replaceAll("_", " ")} report: ${report.category.toLowerCase().replaceAll("_", " ")}`;
}

async function main() {
  const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!connectionString) throw new Error("No database URL configured.");

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  try {
    const reportsWithoutCases = await client.query(
      `SELECT r.id, r."targetType", r."targetId", r.category, r."reporterId",
              r."contextConversationId", r."contextMessageId", r."createdAt"
       FROM "UserReport" r
       LEFT JOIN "ModerationCase" c ON c."linkedReportId" = r.id
       WHERE c.id IS NULL
       ORDER BY r."createdAt" DESC`,
    );
    const casesWithoutReports = await client.query(
      `SELECT c.id, c."linkedReportId"
       FROM "ModerationCase" c
       LEFT JOIN "UserReport" r ON r.id = c."linkedReportId"
       WHERE c."linkedReportId" IS NOT NULL AND r.id IS NULL
       ORDER BY c."createdAt" DESC`,
    );
    const messageReportsMissingMessageIds = await client.query(
      `SELECT r.id, r."targetId", r."contextMessageId"
       FROM "UserReport" r
       LEFT JOIN "Message" m ON m.id = COALESCE(r."contextMessageId", r."targetId")
       WHERE r."targetType" = 'MESSAGE' AND m.id IS NULL
       ORDER BY r."createdAt" DESC`,
    );
    const reportsWithDeletedConversations = await client.query(
      `SELECT r.id, r."contextConversationId"
       FROM "UserReport" r
       LEFT JOIN "Conversation" c ON c.id = r."contextConversationId"
       WHERE r."contextConversationId" IS NOT NULL AND c.id IS NULL
       ORDER BY r."createdAt" DESC`,
    );
    const duplicateCases = await client.query(
      `SELECT "linkedReportId", COUNT(*)::int AS count, ARRAY_AGG(id ORDER BY "createdAt") AS ids
       FROM "ModerationCase"
       WHERE "linkedReportId" IS NOT NULL
       GROUP BY "linkedReportId"
       HAVING COUNT(*) > 1`,
    );
    const enforcementWithoutCases = await client.query(
      `SELECT e.id, e."caseId"
       FROM "EnforcementAction" e
       LEFT JOIN "ModerationCase" c ON c.id = e."caseId"
       WHERE c.id IS NULL
       ORDER BY e."createdAt" DESC`,
    );
    const appealsWithoutActions = await client.query(
      `SELECT a.id, a."enforcementActionId"
       FROM "EnforcementAppeal" a
       LEFT JOIN "EnforcementAction" e ON e.id = a."enforcementActionId"
       WHERE e.id IS NULL
       ORDER BY a."createdAt" DESC`,
    );
    const orphanedRequiredRelations = await client.query(
      `SELECT 'opportunity_report_reporter' AS kind, r.id
       FROM "OpportunityReport" r
       LEFT JOIN "User" u ON u.id = r."reporterId"
       WHERE u.id IS NULL
       UNION ALL
       SELECT 'opportunity_report_opportunity', r.id
       FROM "OpportunityReport" r
       LEFT JOIN "Opportunity" o ON o.id = r."opportunityId"
       WHERE o.id IS NULL
       UNION ALL
       SELECT 'user_report_reporter', r.id
       FROM "UserReport" r
       LEFT JOIN "User" u ON u.id = r."reporterId"
       WHERE u.id IS NULL
       UNION ALL
       SELECT 'message_sender', m.id
       FROM "Message" m
       LEFT JOIN "User" u ON u.id = m."senderId"
       WHERE u.id IS NULL
       UNION ALL
       SELECT 'blocker_user', b.id
       FROM "BlockedUser" b
       LEFT JOIN "User" u ON u.id = b."blockerUserId"
       WHERE u.id IS NULL
       UNION ALL
       SELECT 'blocked_user', b.id
       FROM "BlockedUser" b
       LEFT JOIN "User" u ON u.id = b."blockedUserId"
       WHERE u.id IS NULL`,
    );
    const staleMessageScopes = await client.query(
      `SELECT s.id,
              CASE
                WHEN c.id IS NULL THEN 'case'
                WHEN conversation.id IS NULL THEN 'conversation'
                WHEN s."messageId" IS NOT NULL AND message.id IS NULL THEN 'message'
                WHEN actor.id IS NULL THEN 'revealing_admin'
                WHEN s."conversationId" <> c."conversationId" THEN 'case_conversation_mismatch'
                WHEN s."messageId" IS DISTINCT FROM c."messageId" THEN 'case_message_mismatch'
                ELSE 'unknown'
              END AS kind
       FROM "ModerationMessageScope" s
       LEFT JOIN "ModerationCase" c ON c.id = s."caseId"
       LEFT JOIN "Conversation" conversation ON conversation.id = s."conversationId"
       LEFT JOIN "Message" message
         ON message.id = s."messageId" AND message."conversationId" = s."conversationId"
       LEFT JOIN "User" actor ON actor.id = s."revealedById"
       WHERE c.id IS NULL
          OR conversation.id IS NULL
          OR (s."messageId" IS NOT NULL AND message.id IS NULL)
          OR actor.id IS NULL
          OR s."conversationId" <> c."conversationId"
          OR s."messageId" IS DISTINCT FROM c."messageId"`,
    );

    const result = {
      dryRun: !fix,
      reportsWithoutCases: reportsWithoutCases.rows.map((row) => row.id),
      casesWithoutReports: casesWithoutReports.rows.map((row) => row.id),
      messageReportsMissingMessageIds: messageReportsMissingMessageIds.rows.map((row) => row.id),
      reportsWithDeletedConversations: reportsWithDeletedConversations.rows.map((row) => row.id),
      duplicateCases: duplicateCases.rows,
      enforcementWithoutCases: enforcementWithoutCases.rows.map((row) => row.id),
      appealsWithoutActions: appealsWithoutActions.rows.map((row) => row.id),
      orphanedRequiredRelations: orphanedRequiredRelations.rows,
      staleMessageScopes: staleMessageScopes.rows,
    };

    if (fix && reportsWithoutCases.rowCount) {
      await client.query("BEGIN");
      try {
        for (const report of reportsWithoutCases.rows) {
          const caseId = `case_${crypto.randomUUID()}`;
          await client.query(
            `INSERT INTO "ModerationCase" (
              id, source, status, priority, category, title, summary,
              "targetType", "targetId", "reporterId", "linkedReportId",
              "conversationId", "messageId", "createdAt", "updatedAt"
            )
            VALUES ($1, $2, 'NEW', 'NORMAL', $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())`,
            [
              caseId,
              sourceForTarget(report.targetType),
              report.category,
              titleForReport(report),
              "Legacy report converted into a moderation case with metadata only.",
              report.targetType,
              report.targetId,
              report.reporterId,
              report.id,
              report.contextConversationId,
              report.contextMessageId,
              report.createdAt,
            ],
          );
          await client.query(
            `INSERT INTO "ModerationCaseEvent" (
              id, "caseId", type, reason, note, "nextStatus", "createdAt"
            )
            VALUES ($1, $2, $3, $4, $5, 'NEW', NOW())`,
            [
              `caseevent_${crypto.randomUUID()}`,
              caseId,
              "case.created_from_audit_repair",
              "Moderation data audit repair",
              "Metadata-only case created for a legacy report. Private evidence remains hidden.",
            ],
          );
        }
        await client.query("COMMIT");
        result.repairedReports = reportsWithoutCases.rows.map((row) => row.id);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }

    console.log(JSON.stringify(result, null, 2));
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(`moderation audit failed: ${error.message}`);
  process.exit(1);
});
