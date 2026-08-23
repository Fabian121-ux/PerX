import { test, expect, type Locator, type Page } from "@playwright/test";
import crypto from "node:crypto";

import { hasIsolatedTestDatabase } from "./utils/db-guard";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3100";
const TEST_DB = process.env.TEST_DATABASE_URL ?? "";

const SESSION_COOKIE = process.env.SESSION_COOKIE_NAME ?? "perx_session";

const isIsolatedDb = hasIsolatedTestDatabase();

const describeOrSkip = isIsolatedDb ? test.describe : test.describe.skip;

describeOrSkip(
  "Authenticated multi-user acceptance (requires isolated test DB)",
  () => {
    const createdSessionIds = new Set<string>();

    test.afterEach(async () => {
      const sessionIds = [...createdSessionIds];
      createdSessionIds.clear();
      if (!sessionIds.length) return;

      const { Pool } = await import("pg");
      const pool = new Pool({ connectionString: TEST_DB, ssl: false });
      try {
        await pool.query(`DELETE FROM "Session" WHERE id = ANY($1::text[])`, [
          sessionIds,
        ]);
      } finally {
        await pool.end();
      }
    });

    async function createSession(page: Page, email: string) {
      const { Pool } = await import("pg");
      const pool = new Pool({ connectionString: TEST_DB, ssl: false });
      try {
        const user = await pool.query<{ id: string }>(
          `SELECT id FROM "User" WHERE email = $1`,
          [email],
        );
        if (user.rows.length === 0) throw new Error(`User ${email} not found`);

        const token = crypto.randomBytes(32).toString("base64url");
        const tokenHash = crypto
          .createHash("sha256")
          .update(token)
          .digest("hex");
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
        const sessionId = `sess_${crypto.randomUUID()}`;

        await pool.query(
          `INSERT INTO "Session" (id, "tokenHash", "userId", "expiresAt", "createdAt", "lastSeenAt")
         VALUES ($1, $2, $3, $4, NOW(), NOW())`,
          [sessionId, tokenHash, user.rows[0].id, expiresAt],
        );
        createdSessionIds.add(sessionId);

        try {
          await page.context().addCookies([
            {
              name: SESSION_COOKIE,
              value: token,
              domain: new URL(BASE).hostname,
              path: "/",
              httpOnly: true,
              sameSite: "Lax",
            },
          ]);
        } catch (error) {
          createdSessionIds.delete(sessionId);
          await pool.query(`DELETE FROM "Session" WHERE id = $1`, [sessionId]);
          throw error;
        }

        return user.rows[0].id;
      } finally {
        await pool.end();
      }
    }

    async function getSeedConversationId() {
      const { Pool } = await import("pg");
      const pool = new Pool({ connectionString: TEST_DB, ssl: false });
      try {
        const result = await pool.query<{ id: string }>(
          `SELECT c.id
         FROM "Conversation" c
         JOIN "ConversationParticipant" alice_participant
           ON alice_participant."conversationId" = c.id
         JOIN "User" alice ON alice.id = alice_participant."userId"
         JOIN "ConversationParticipant" bob_participant
           ON bob_participant."conversationId" = c.id
         JOIN "User" bob ON bob.id = bob_participant."userId"
          JOIN "Message" seed_message ON seed_message."conversationId" = c.id
          WHERE alice.email = $1
            AND bob.email = $2
            AND c."opportunityId" IS NULL
            AND seed_message.body = 'Hello from Alice!'
          ORDER BY c."createdAt", c.id
         LIMIT 1`,
          ["alice-test@perx.test", "bob-test@perx.test"],
        );
        if (!result.rows[0]?.id) throw new Error("Seed conversation not found");
        return result.rows[0].id;
      } finally {
        await pool.end();
      }
    }

    function testCuid() {
      return `c${crypto.randomBytes(12).toString("hex")}`;
    }

    async function createIsolatedConversation(messageCount = 1) {
      const { Pool } = await import("pg");
      const pool = new Pool({ connectionString: TEST_DB, ssl: false });
      const conversationId = testCuid();
      const messageIdPrefix = `c${crypto.randomBytes(8).toString("hex")}`;
      try {
        const users = await pool.query(
          `SELECT id, email FROM "User" WHERE email = ANY($1::text[])`,
          [["alice-test@perx.test", "bob-test@perx.test"]],
        );
        const aliceId = users.rows.find(
          (row) => row.email === "alice-test@perx.test",
        )?.id as string | undefined;
        const bobId = users.rows.find(
          (row) => row.email === "bob-test@perx.test",
        )?.id as string | undefined;
        if (!aliceId || !bobId) throw new Error("Test participants not found");

        await pool.query("BEGIN");
        await pool.query(
          `INSERT INTO "Conversation" (id, status, "createdAt", "updatedAt")
           VALUES ($1, 'ACTIVE', NOW(), NOW())`,
          [conversationId],
        );
        await pool.query(
          `INSERT INTO "ConversationParticipant" (id, "conversationId", "userId", "createdAt")
           VALUES ($1, $2, $3, NOW()), ($4, $2, $5, NOW())`,
          [testCuid(), conversationId, aliceId, testCuid(), bobId],
        );
        await pool.query(
          `INSERT INTO "Message" (id, "conversationId", "senderId", body, "createdAt")
           SELECT $1 || LPAD(value::text, 4, '0'),
                  $2,
                  $3,
                  'Isolated acceptance message ' || value::text || ' with enough text to create a scrollable mobile timeline.',
                  NOW() - (($4 - value) * INTERVAL '1 second')
           FROM generate_series(1, $4) AS value`,
          [messageIdPrefix, conversationId, bobId, messageCount],
        );
        await pool.query("COMMIT");
        return conversationId;
      } catch (error) {
        await pool.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        await pool.end();
      }
    }

    async function createMessageInteractionFixture() {
      const conversationId = await createIsolatedConversation(28);
      const { Pool } = await import("pg");
      const pool = new Pool({ connectionString: TEST_DB, ssl: false });
      const incomingId = testCuid();
      const ownEditId = testCuid();
      const ownDeleteId = testCuid();
      const expiredOwnId = testCuid();
      const replyId = testCuid();
      try {
        const users = await pool.query<{
          email: string;
          id: string;
          name: string;
        }>(
          `SELECT email, id, name
           FROM "User"
           WHERE email = ANY($1::text[])`,
          [["alice-test@perx.test", "bob-test@perx.test"]],
        );
        const alice = users.rows.find(
          (user) => user.email === "alice-test@perx.test",
        );
        const bob = users.rows.find(
          (user) => user.email === "bob-test@perx.test",
        );
        if (!alice || !bob) throw new Error("Message fixture users not found");

        await pool.query("BEGIN");
        await pool.query(
          `INSERT INTO "Message" (
             id, "conversationId", "senderId", "replyToMessageId", body, "createdAt"
           ) VALUES
             ($1, $6, $7, NULL, 'Gesture incoming target', NOW() - INTERVAL '5 seconds'),
             ($2, $6, $8, NULL, 'Gesture own edit target', NOW() - INTERVAL '4 seconds'),
             ($3, $6, $8, NULL, 'Gesture own delete target', NOW() - INTERVAL '3 seconds'),
             ($4, $6, $8, NULL, 'Gesture expired own target', NOW() - INTERVAL '2 days'),
             ($5, $6, $7, $1, 'Gesture interactive reply target', NOW() - INTERVAL '1 second')`,
          [
            incomingId,
            ownEditId,
            ownDeleteId,
            expiredOwnId,
            replyId,
            conversationId,
            bob.id,
            alice.id,
          ],
        );
        await pool.query(
          `UPDATE "Conversation" SET "updatedAt" = NOW() WHERE id = $1`,
          [conversationId],
        );
        await pool.query("COMMIT");
        return {
          aliceId: alice.id,
          bobId: bob.id,
          bobName: bob.name,
          conversationId,
          expiredOwnId,
          incomingId,
          ownDeleteId,
          ownEditId,
          replyId,
        };
      } catch (error) {
        await pool.query("ROLLBACK").catch(() => undefined);
        await deleteIsolatedConversation(conversationId).catch(() => undefined);
        throw error;
      } finally {
        await pool.end();
      }
    }

    async function deleteIsolatedConversation(conversationId: string) {
      const { Pool } = await import("pg");
      const pool = new Pool({ connectionString: TEST_DB, ssl: false });
      try {
        await pool.query(
          `DELETE FROM "AuditLog"
           WHERE metadata->>'conversationId' = $1
              OR "entityId" IN (
                SELECT id FROM "Message" WHERE "conversationId" = $1
              )`,
          [conversationId],
        );
        await pool.query(
          `DELETE FROM "Notification"
           WHERE metadata->>'conversationId' = $1
              OR "actionUrl" = $2
              OR "actionUrl" LIKE $3`,
          [
            conversationId,
            `/app/messages/${conversationId}`,
            `/app/messages/${conversationId}?%`,
          ],
        );
        await pool.query(
          `DELETE FROM "ConversationEvent" WHERE "conversationId" = $1`,
          [conversationId],
        );
        await pool.query(`DELETE FROM "Conversation" WHERE id = $1`, [
          conversationId,
        ]);
      } finally {
        await pool.end();
      }
    }

    async function createConversationDealEntryFixture() {
      const { Pool } = await import("pg");
      const pool = new Pool({ connectionString: TEST_DB, ssl: false });
      const conversationId = testCuid();
      try {
        const result = await pool.query<{
          aliceId: string;
          bobId: string;
          bobName: string;
          opportunityId: string;
          opportunityTitle: string;
        }>(
          `SELECT alice.id AS "aliceId",
                  bob.id AS "bobId",
                  bob.name AS "bobName",
                  opportunity.id AS "opportunityId",
                  opportunity.title AS "opportunityTitle"
           FROM "User" alice
           CROSS JOIN "User" bob
           JOIN "Opportunity" opportunity ON opportunity."ownerId" = bob.id
           WHERE alice.email = $1
             AND bob.email = $2
             AND opportunity.slug = $3
             AND opportunity.status = 'PUBLISHED'
             AND opportunity."moderationStatus" = 'APPROVED'`,
          ["alice-test@perx.test", "bob-test@perx.test", "bob-mech-keyboard"],
        );
        const fixture = result.rows[0];
        if (!fixture) throw new Error("Deal-entry fixture context not found");

        await pool.query("BEGIN");
        await pool.query(
          `INSERT INTO "Conversation" (
             id, "opportunityId", status, "createdAt", "updatedAt"
           ) VALUES ($1, $2, 'ACTIVE', NOW(), NOW())`,
          [conversationId, fixture.opportunityId],
        );
        await pool.query(
          `INSERT INTO "ConversationParticipant" (
             id, "conversationId", "userId", "createdAt"
           ) VALUES ($1, $2, $3, NOW()), ($4, $2, $5, NOW())`,
          [
            testCuid(),
            conversationId,
            fixture.aliceId,
            testCuid(),
            fixture.bobId,
          ],
        );
        await pool.query(
          `INSERT INTO "Message" (
             id, "conversationId", "senderId", body, "createdAt"
           ) VALUES ($1, $2, $3, $4, NOW())`,
          [
            testCuid(),
            conversationId,
            fixture.bobId,
            "Use the structured terms entry when you are ready.",
          ],
        );
        await pool.query("COMMIT");
        return {
          aliceId: fixture.aliceId,
          bobId: fixture.bobId,
          bobName: fixture.bobName,
          conversationId,
          opportunityId: fixture.opportunityId,
          opportunityTitle: fixture.opportunityTitle,
        };
      } catch (error) {
        await pool.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        await pool.end();
      }
    }

    async function deleteConversationDealEntryFixture(conversationId: string) {
      await deleteProposalLifecycleFixture({ conversationId });
    }

    async function createBlockedPairFixture(
      blockerId: string,
      blockedId: string,
    ) {
      const { Pool } = await import("pg");
      const pool = new Pool({ connectionString: TEST_DB, ssl: false });
      const blockId = `block_${crypto.randomUUID()}`;
      try {
        const result = await pool.query<{ id: string }>(
          `INSERT INTO "BlockedUser" (id, "blockerUserId", "blockedUserId", "createdAt")
           VALUES ($1, $2, $3, NOW())
           ON CONFLICT ("blockerUserId", "blockedUserId") DO NOTHING
           RETURNING id`,
          [blockId, blockerId, blockedId],
        );
        return result.rows[0]?.id ?? null;
      } finally {
        await pool.end();
      }
    }

    async function deleteBlockedPairFixture(blockId: string | null) {
      if (!blockId) return;
      const { Pool } = await import("pg");
      const pool = new Pool({ connectionString: TEST_DB, ssl: false });
      try {
        await pool.query(`DELETE FROM "BlockedUser" WHERE id = $1`, [blockId]);
      } finally {
        await pool.end();
      }
    }

    async function deleteProposalLifecycleFixture({
      conversationId,
      descriptions = [],
      proposalId,
    }: {
      conversationId?: string;
      descriptions?: string[];
      proposalId?: string;
    }) {
      const { Pool } = await import("pg");
      const pool = new Pool({ connectionString: TEST_DB, ssl: false });
      try {
        await pool.query("BEGIN");
        const proposals = await pool.query<{
          conversationId: string | null;
          id: string;
        }>(
          `SELECT id, "conversationId"
           FROM "Proposal"
           WHERE ($1::text IS NOT NULL AND id = $1)
              OR ($2::text IS NOT NULL AND "conversationId" = $2)
              OR (cardinality($3::text[]) > 0 AND description = ANY($3::text[]))`,
          [proposalId ?? null, conversationId ?? null, descriptions],
        );
        const proposalIds = proposals.rows.map((proposal) => proposal.id);
        const conversationIds = [
          ...new Set(
            [
              conversationId,
              ...proposals.rows.map((proposal) => proposal.conversationId),
            ].filter((value): value is string => Boolean(value)),
          ),
        ];
        const versions = await pool.query<{ id: string }>(
          `SELECT id FROM "ProposalVersion"
           WHERE "proposalId" = ANY($1::text[])`,
          [proposalIds],
        );
        const versionIds = versions.rows.map((version) => version.id);
        const deals = await pool.query<{ id: string }>(
          `SELECT id FROM "Deal" WHERE "proposalId" = ANY($1::text[])`,
          [proposalIds],
        );
        const dealIds = deals.rows.map((deal) => deal.id);
        const entityIds = [...proposalIds, ...versionIds, ...dealIds];
        const actionPatterns = conversationIds.map(
          (id) => `/app/messages/${id}%`,
        );

        await pool.query(
          `DELETE FROM "Notification"
           WHERE metadata->>'conversationId' = ANY($1::text[])
              OR metadata->>'proposalId' = ANY($2::text[])
              OR metadata->>'proposalVersionId' = ANY($3::text[])
              OR metadata->>'dealId' = ANY($4::text[])
              OR "actionUrl" LIKE ANY($5::text[])`,
          [conversationIds, proposalIds, versionIds, dealIds, actionPatterns],
        );
        await pool.query(
          `DELETE FROM "AuditLog"
           WHERE "entityId" = ANY($1::text[])
              OR metadata->>'conversationId' = ANY($2::text[])
              OR metadata->>'proposalId' = ANY($3::text[])
              OR metadata->>'proposalVersionId' = ANY($4::text[])
              OR metadata->>'dealId' = ANY($5::text[])`,
          [entityIds, conversationIds, proposalIds, versionIds, dealIds],
        );
        await pool.query(
          `DELETE FROM "ConversationEvent"
           WHERE "conversationId" = ANY($1::text[])
              OR "proposalVersionId" = ANY($2::text[])
              OR "dealId" = ANY($3::text[])`,
          [conversationIds, versionIds, dealIds],
        );
        await pool.query(
          `DELETE FROM "Approval" WHERE "dealId" = ANY($1::text[])`,
          [dealIds],
        );
        await pool.query(
          `DELETE FROM "Release" WHERE "dealId" = ANY($1::text[])`,
          [dealIds],
        );
        await pool.query(`DELETE FROM "Deal" WHERE id = ANY($1::text[])`, [
          dealIds,
        ]);
        if (proposalIds.length) {
          await pool.query(
            `ALTER TABLE "ProposalVersionMilestone"
             DISABLE TRIGGER "ProposalVersionMilestone_immutable_terms"`,
          );
          await pool.query(
            `ALTER TABLE "ProposalVersion"
             DISABLE TRIGGER "ProposalVersion_immutable_terms"`,
          );
          await pool.query(
            `UPDATE "ProposalVersion"
             SET "supersedesVersionId" = NULL
             WHERE "proposalId" = ANY($1::text[])`,
            [proposalIds],
          );
          await pool.query(
            `DELETE FROM "Proposal" WHERE id = ANY($1::text[])`,
            [proposalIds],
          );
          await pool.query(
            `ALTER TABLE "ProposalVersion"
             ENABLE TRIGGER "ProposalVersion_immutable_terms"`,
          );
          await pool.query(
            `ALTER TABLE "ProposalVersionMilestone"
             ENABLE TRIGGER "ProposalVersionMilestone_immutable_terms"`,
          );
        }
        await pool.query(
          `DELETE FROM "Conversation" WHERE id = ANY($1::text[])`,
          [conversationIds],
        );
        await pool.query("COMMIT");
      } catch (error) {
        await pool.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        await pool.end();
      }
    }

    async function deleteOpportunityByTitle(title: string) {
      const { Pool } = await import("pg");
      const pool = new Pool({ connectionString: TEST_DB, ssl: false });
      try {
        await pool.query("BEGIN");
        const opportunities = await pool.query<{ id: string }>(
          `SELECT id FROM "Opportunity" WHERE title = $1`,
          [title],
        );
        const ids = opportunities.rows.map((opportunity) => opportunity.id);
        await pool.query(
          `DELETE FROM "AuditLog"
           WHERE "entityType" = 'opportunity'
             AND "entityId" = ANY($1::text[])`,
          [ids],
        );
        await pool.query(
          `DELETE FROM "Opportunity" WHERE id = ANY($1::text[])`,
          [ids],
        );
        await pool.query("COMMIT");
      } catch (error) {
        await pool.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        await pool.end();
      }
    }

    /**
     * Seeds enough published posts to force at least two feed pages, plus a
     * blocked author and a set of ineligible posts that must never surface.
     *
     * Authors are distinct so the diversity rule cannot mask a missing post,
     * and `publishedAt` is spaced by minute so keyset ordering is unambiguous.
     */
    async function createHomeFeedFixture(viewerEmail: string) {
      const { Pool } = await import("pg");
      const pool = new Pool({ connectionString: TEST_DB, ssl: false });
      const runId = crypto.randomUUID().slice(0, 8);
      const authorIds: string[] = [];
      const opportunityIds: string[] = [];
      let blockId = "";

      try {
        await pool.query("BEGIN");
        const viewer = await pool.query<{ id: string }>(
          `SELECT id FROM "User" WHERE email = $1`,
          [viewerEmail],
        );
        const viewerId = viewer.rows[0]?.id;
        if (!viewerId) throw new Error(`Viewer ${viewerEmail} not found`);

        // 20 authors, one post each: more than one page of 12.
        for (let index = 0; index < 20; index += 1) {
          const authorId = `feeduser_${runId}_${index}`;
          authorIds.push(authorId);
          await pool.query(
            `INSERT INTO "User" (id,email,"passwordHash",name,username,"accountClassification","emailVerifiedAt","verificationStatus","isActive","createdAt","updatedAt")
             VALUES ($1,$2,'x',$3,$4,'PUBLIC_BETA_USER',NOW(),'VERIFIED',true,NOW(),NOW())`,
            [
              authorId,
              `${authorId}@perx.test`,
              `Feed Author ${index}`,
              authorId,
            ],
          );
          await pool.query(
            `INSERT INTO "Profile" (id,"userId",headline,biography,location,"isDiscoverable","createdAt","updatedAt")
             VALUES ($1,$2,'Feed author','Bio','Lagos',true,NOW(),NOW())`,
            [`feedprof_${runId}_${index}`, authorId],
          );

          const opportunityId = `feedopp_${runId}_${index}`;
          opportunityIds.push(opportunityId);
          await pool.query(
            `INSERT INTO "Opportunity" (id,"ownerId",type,status,"moderationStatus",title,slug,summary,description,remote,currency,skills,"publishedAt","createdAt","updatedAt")
             VALUES ($1,$2,'JOB','PUBLISHED','APPROVED',$3,$4,$5,'Description',true,'NGN',ARRAY['x'],NOW() - ($6||' minutes')::interval,NOW(),NOW())`,
            [
              opportunityId,
              authorId,
              `FeedPost ${runId} ${index}`,
              `feedpost-${runId}-${index}`,
              `Feed summary ${index}`,
              String(index + 1),
            ],
          );
        }

        // Ineligible posts by an otherwise-valid author: each must be hidden
        // for a different reason.
        const hiddenAuthor = authorIds[0];
        for (const [suffix, status, moderation] of [
          ["draft", "DRAFT", "APPROVED"],
          ["pending", "PUBLISHED", "PENDING"],
          ["archived", "ARCHIVED", "APPROVED"],
        ] as const) {
          const id = `feedhidden_${runId}_${suffix}`;
          opportunityIds.push(id);
          await pool.query(
            `INSERT INTO "Opportunity" (id,"ownerId",type,status,"moderationStatus",title,slug,summary,description,remote,currency,skills,"publishedAt","createdAt","updatedAt")
             VALUES ($1,$2,'JOB',$3,$4,$5,$6,'Hidden','Description',true,'NGN',ARRAY['x'],NOW(),NOW(),NOW())`,
            [
              id,
              hiddenAuthor,
              status,
              moderation,
              `HiddenPost ${runId} ${suffix}`,
              `hiddenpost-${runId}-${suffix}`,
            ],
          );
        }

        // A blocked author with a fully valid published post. B3 block
        // semantics must keep it out of the feed.
        const blockedAuthorId = `feedblocked_${runId}`;
        authorIds.push(blockedAuthorId);
        await pool.query(
          `INSERT INTO "User" (id,email,"passwordHash",name,username,"accountClassification","emailVerifiedAt","verificationStatus","isActive","createdAt","updatedAt")
           VALUES ($1,$2,'x','Blocked Author',$3,'PUBLIC_BETA_USER',NOW(),'VERIFIED',true,NOW(),NOW())`,
          [blockedAuthorId, `${blockedAuthorId}@perx.test`, blockedAuthorId],
        );
        await pool.query(
          `INSERT INTO "Profile" (id,"userId",headline,biography,location,"isDiscoverable","createdAt","updatedAt")
           VALUES ($1,$2,'Blocked','Bio','Lagos',true,NOW(),NOW())`,
          [`feedblockedprof_${runId}`, blockedAuthorId],
        );
        const blockedPostId = `feedblockedopp_${runId}`;
        opportunityIds.push(blockedPostId);
        await pool.query(
          `INSERT INTO "Opportunity" (id,"ownerId",type,status,"moderationStatus",title,slug,summary,description,remote,currency,skills,"publishedAt","createdAt","updatedAt")
           VALUES ($1,$2,'JOB','PUBLISHED','APPROVED',$3,$4,'Blocked summary','Description',true,'NGN',ARRAY['x'],NOW(),NOW(),NOW())`,
          [
            blockedPostId,
            blockedAuthorId,
            `BlockedPost ${runId}`,
            `blockedpost-${runId}`,
          ],
        );
        blockId = `feedblock_${runId}`;
        await pool.query(
          `INSERT INTO "BlockedUser" (id,"blockerUserId","blockedUserId","createdAt")
           VALUES ($1,$2,$3,NOW())`,
          [blockId, viewerId, blockedAuthorId],
        );

        await pool.query("COMMIT");
        return {
          authorIds,
          blockId,
          blockedPostTitle: `BlockedPost ${runId}`,
          hiddenTitlePrefix: `HiddenPost ${runId}`,
          opportunityIds,
          runId,
          viewerId,
        };
      } catch (error) {
        await pool.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        await pool.end();
      }
    }

    async function deleteHomeFeedFixture(fixture: {
      authorIds: string[];
      blockId: string;
      opportunityIds: string[];
    }) {
      const { Pool } = await import("pg");
      const pool = new Pool({ connectionString: TEST_DB, ssl: false });
      try {
        await pool.query(`DELETE FROM "BlockedUser" WHERE id = $1`, [
          fixture.blockId,
        ]);
        await pool.query(
          `DELETE FROM "OpportunityBookmark" WHERE "opportunityId" = ANY($1::text[])`,
          [fixture.opportunityIds],
        );
        await pool.query(
          `DELETE FROM "Opportunity" WHERE id = ANY($1::text[])`,
          [fixture.opportunityIds],
        );
        await pool.query(`DELETE FROM "Profile" WHERE "userId" = ANY($1::text[])`, [
          fixture.authorIds,
        ]);
        await pool.query(`DELETE FROM "User" WHERE id = ANY($1::text[])`, [
          fixture.authorIds,
        ]);
      } finally {
        await pool.end();
      }
    }

    function opportunityDraftKey(userId: string, type: "PRODUCT" | "SERVICE") {
      return `perx:opportunity-composer:v1:${encodeURIComponent(userId)}:${type}`;
    }

    function browserDraftFields(type: "PRODUCT" | "SERVICE", title: string) {
      return {
        budgetMax: "",
        budgetMin: "",
        category: type === "PRODUCT" ? "market" : "services",
        contactPreference: "",
        currency: "NGN",
        description:
          "A complete browser recovery description with enough detail for a user to understand the scope and expected outcome.",
        listingRulesAccepted: false,
        location: "",
        propertyListingType: "",
        propertyType: "",
        remote: true,
        skills: "",
        summary: "A complete browser recovery summary for this opportunity.",
        title,
      };
    }

    async function fillRequiredPost(page: Page, title: string) {
      await page.getByLabel("Post title").fill(title);
      await page
        .getByLabel("Short summary")
        .fill("A valid summary that is long enough for server validation.");
      await page
        .getByLabel("Details")
        .fill(
          "A complete opportunity description with enough scope, outcomes, timing, and expectations to pass the server validation contract.",
        );
    }

    async function dispatchTouch(
      target: Locator,
      type: "touchcancel" | "touchend" | "touchmove" | "touchstart",
      x: number,
      y: number,
    ) {
      const touch = { clientX: x, clientY: y, identifier: 1 };
      await target.dispatchEvent(type, {
        changedTouches: [touch],
        touches: type === "touchend" || type === "touchcancel" ? [] : [touch],
      });
    }

    async function createAdminUsersBrowserFixture() {
      const { Pool } = await import("pg");
      const pool = new Pool({ connectionString: TEST_DB, ssl: false });
      const prefix = crypto.randomUUID();
      const ids = Array.from({ length: 22 }, () => testCuid());
      const passwordHash = `browser-password-hash-${prefix}`;
      const sessionHash = `browser-session-hash-${prefix}`;
      const storageKey = `private/storage/${prefix}`;
      const privateMessageBody = `private-admin-payload-${prefix}`;
      const privateMessageId = testCuid();
      const restrictedName = `Admin Fixture User 22 ${prefix}`;
      try {
        const context = await pool.query<{
          aliceId: string;
          conversationId: string;
          memberRoleId: string;
        }>(
          `SELECT alice.id AS "aliceId",
                  conversation.id AS "conversationId",
                  role.id AS "memberRoleId"
           FROM "User" alice
           CROSS JOIN "Role" role
           JOIN "ConversationParticipant" participant
             ON participant."userId" = alice.id
           JOIN "Conversation" conversation
             ON conversation.id = participant."conversationId"
           JOIN "Message" message
             ON message."conversationId" = conversation.id
           WHERE alice.email = $1
             AND role.name = 'MEMBER'
             AND message.body = 'Hello from Alice!'
           ORDER BY conversation."createdAt", conversation.id
           LIMIT 1`,
          ["alice-test@perx.test"],
        );
        const row = context.rows[0];
        if (!row) throw new Error("Admin browser fixture context not found");

        await pool.query("BEGIN");
        for (const [index, id] of ids.entries()) {
          const suffix = String(index + 1).padStart(2, "0");
          const restricted = index === ids.length - 1;
          await pool.query(
            `INSERT INTO "User" (
               id, email, "passwordHash", name, username,
               "accountClassification", "verificationStatus", "isActive",
               "messagingRestrictedUntil", "connectionRequestsRestrictedUntil",
               "publishingRestrictedUntil", "imageStorageKey", "createdAt", "updatedAt"
             ) VALUES (
               $1, $2, $3, $4, $5,
               'PUBLIC_BETA_USER', 'UNVERIFIED', TRUE,
               $6, $6, $6, $7, $8, $8
             )`,
            [
              id,
              `admin-fixture-${suffix}-${prefix}@perx.test`,
              passwordHash,
              restricted
                ? restrictedName
                : `Admin Fixture User ${suffix} ${prefix}`,
              `admin_fixture_${suffix}_${prefix.replaceAll("-", "")}`,
              restricted ? new Date("2099-12-31T23:59:59.000Z") : null,
              storageKey,
              new Date(`2099-01-${suffix}T12:00:00.000Z`),
            ],
          );
        }
        await pool.query(
          `INSERT INTO "UserRole" (id, "userId", "roleId", "createdAt")
           VALUES ($1, $2, $3, NOW())`,
          [testCuid(), ids.at(-1), row.memberRoleId],
        );
        await pool.query(
          `INSERT INTO "Session" (
             id, "tokenHash", "userId", "expiresAt", "createdAt", "lastSeenAt"
           ) VALUES ($1, $2, $3, NOW() + INTERVAL '1 hour', NOW(), NOW())`,
          [`fixture_session_${prefix}`, sessionHash, ids[0]],
        );
        await pool.query(
          `INSERT INTO "Message" (
             id, "conversationId", "senderId", body, "createdAt"
           ) VALUES ($1, $2, $3, $4, NOW())`,
          [
            privateMessageId,
            row.conversationId,
            row.aliceId,
            privateMessageBody,
          ],
        );
        await pool.query("COMMIT");
        return {
          ids,
          passwordHash,
          privateMessageBody,
          privateMessageId,
          restrictedName,
          sessionHash,
          storageKey,
        };
      } catch (error) {
        await pool.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        await pool.end();
      }
    }

    async function deleteAdminUsersBrowserFixture(
      fixture: Awaited<ReturnType<typeof createAdminUsersBrowserFixture>>,
    ) {
      const { Pool } = await import("pg");
      const pool = new Pool({ connectionString: TEST_DB, ssl: false });
      try {
        await pool.query("BEGIN");
        await pool.query(`DELETE FROM "Message" WHERE id = $1`, [
          fixture.privateMessageId,
        ]);
        await pool.query(`DELETE FROM "User" WHERE id = ANY($1::text[])`, [
          fixture.ids,
        ]);
        await pool.query("COMMIT");
      } catch (error) {
        await pool.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        await pool.end();
      }
    }

    async function createNotificationPaginationFixture() {
      const { Pool } = await import("pg");
      const pool = new Pool({ connectionString: TEST_DB, ssl: false });
      const notificationPrefix = `pagination_${crypto.randomUUID()}_`;
      const createdAt = new Date("2099-08-01T12:00:00.000Z");
      const titlePrefix = `Pagination ${crypto.randomUUID()}`;
      const ids = Array.from(
        { length: 52 },
        (_, index) =>
          `${notificationPrefix}${String(index + 1).padStart(3, "0")}`,
      );
      ids.push(`${notificationPrefix}system`);
      try {
        const user = await pool.query<{ id: string }>(
          `SELECT id FROM "User" WHERE email = $1`,
          ["alice-test@perx.test"],
        );
        const userId = user.rows[0]?.id as string | undefined;
        if (!userId) throw new Error("Notification fixture user not found");

        await pool.query("BEGIN");
        await pool.query(
          `INSERT INTO "Notification" (
             id, "userId", type, title, body, "createdAt"
           )
           SELECT $1 || LPAD(value::text, 3, '0'),
                  $2,
                  'MESSAGE',
                   $4 || ' message ' || LPAD(value::text, 3, '0'),
                  'Equal-timestamp notification pagination fixture',
                  $3
           FROM generate_series(1, 52) AS value`,
          [notificationPrefix, userId, createdAt, titlePrefix],
        );
        await pool.query(
          `INSERT INTO "Notification" (
             id, "userId", type, title, body, "createdAt"
           ) VALUES ($1, $2, 'SYSTEM', $3, $4, $5)`,
          [
            `${notificationPrefix}system`,
            userId,
            `${titlePrefix} system sentinel`,
            "This record must stay outside the Messages filter.",
            createdAt,
          ],
        );
        await pool.query("COMMIT");
        return { ids, titlePrefix };
      } catch (error) {
        await pool.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        await pool.end();
      }
    }

    async function deleteNotificationPaginationFixture(ids: string[]) {
      const { Pool } = await import("pg");
      const pool = new Pool({ connectionString: TEST_DB, ssl: false });
      try {
        await pool.query(
          `DELETE FROM "Notification" WHERE id = ANY($1::text[])`,
          [ids],
        );
      } finally {
        await pool.end();
      }
    }

    async function createLongProfileFixture() {
      const { Pool } = await import("pg");
      const pool = new Pool({ connectionString: TEST_DB, ssl: false });
      const fixturePrefix = `profile_${crypto.randomUUID()}`;
      try {
        const result = await pool.query(
          `SELECT u.id AS "userId",
                  p.id AS "profileId",
                  p.biography,
                   p."websiteUrl",
                   p."updatedAt"
           FROM "User" u
           JOIN "Profile" p ON p."userId" = u.id
           WHERE u.email = $1`,
          ["bob-test@perx.test"],
        );
        const original = result.rows[0] as
          | {
              biography: string;
              profileId: string;
              userId: string;
              updatedAt: Date;
              websiteUrl: string | null;
            }
          | undefined;
        if (!original) throw new Error("Long-profile fixture user not found");

        const skillIds = [
          `${fixturePrefix}_skill_1`,
          `${fixturePrefix}_skill_2`,
          `${fixturePrefix}_skill_3`,
        ];
        const workIds = [`${fixturePrefix}_work_1`, `${fixturePrefix}_work_2`];
        const portfolioIds = [
          `${fixturePrefix}_portfolio_1`,
          `${fixturePrefix}_portfolio_2`,
        ];
        await pool.query("BEGIN");
        await pool.query(
          `UPDATE "Profile"
           SET biography = $1,
               "websiteUrl" = $2,
               "updatedAt" = NOW()
           WHERE id = $3`,
          [
            Array.from(
              { length: 8 },
              (_, index) =>
                `Profile evidence paragraph ${index + 1}. Bob documents durable product delivery, accessible interfaces, secure collaboration, and measurable outcomes for clients and partners.`,
            ).join("\n\n"),
            "https://example.com/bob-profile",
            original.profileId,
          ],
        );
        await pool.query(
          `INSERT INTO "ProfileSkill" (id, "profileId", name)
           VALUES ($1, $2, $3), ($4, $2, $5), ($6, $2, $7)
           ON CONFLICT ("profileId", name) DO NOTHING`,
          [
            skillIds[0],
            original.profileId,
            "Profile fixture strategy",
            skillIds[1],
            "Accessible systems",
            skillIds[2],
            "Secure delivery",
          ],
        );
        await pool.query(
          `INSERT INTO "WorkHistory" (
             id, "profileId", title, company, summary, "startedAt", "endedAt"
           ) VALUES
             ($1, $2, 'Lead product engineer', 'Example Studio', $3, $4, NULL),
             ($5, $2, 'Platform engineer', 'Example Labs', $6, $7, $8)`,
          [
            workIds[0],
            original.profileId,
            "Led a multi-year marketplace programme with secure workflows and accessible delivery practices.",
            new Date("2024-01-15T12:00:00.000Z"),
            workIds[1],
            "Built dependable product systems and documented measurable operational improvements.",
            new Date("2021-02-01T00:00:00.000Z"),
            new Date("2023-12-01T00:00:00.000Z"),
          ],
        );
        await pool.query(
          `INSERT INTO "PortfolioItem" (
             id, "profileId", title, description, url, "createdAt"
           ) VALUES
             ($1, $2, 'Trust workflow platform', $3, $4, NOW()),
             ($5, $2, 'Accessible operations dashboard', $6, $7, NOW() - INTERVAL '1 day')`,
          [
            portfolioIds[0],
            original.profileId,
            "A persisted portfolio project with structured milestones, reviews, and clear evidence.",
            "https://example.com/trust-workflow",
            portfolioIds[1],
            "A responsive operations surface tested from small mobile screens through desktop.",
            "https://example.com/operations-dashboard",
          ],
        );

        await pool.query("COMMIT");
        return { original, portfolioIds, skillIds, workIds };
      } catch (error) {
        await pool.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        await pool.end();
      }
    }

    async function deleteLongProfileFixture({
      original,
      portfolioIds,
      skillIds,
      workIds,
    }: Awaited<ReturnType<typeof createLongProfileFixture>>) {
      const { Pool } = await import("pg");
      const pool = new Pool({ connectionString: TEST_DB, ssl: false });
      try {
        await pool.query("BEGIN");
        await pool.query(
          `DELETE FROM "ProfileSkill" WHERE id = ANY($1::text[])`,
          [skillIds],
        );
        await pool.query(
          `DELETE FROM "WorkHistory" WHERE id = ANY($1::text[])`,
          [workIds],
        );
        await pool.query(
          `DELETE FROM "PortfolioItem" WHERE id = ANY($1::text[])`,
          [portfolioIds],
        );
        await pool.query(
          `UPDATE "Profile"
           SET biography = $1,
               "websiteUrl" = $2,
                "updatedAt" = $3
            WHERE id = $4`,
          [
            original.biography,
            original.websiteUrl,
            original.updatedAt,
            original.profileId,
          ],
        );
        await pool.query("COMMIT");
      } catch (error) {
        await pool.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        await pool.end();
      }
    }

    async function insertLegacyConversationEvent(conversationId: string) {
      const { Pool } = await import("pg");
      const pool = new Pool({ connectionString: TEST_DB, ssl: false });
      const eventId = `legacy_event_${crypto.randomUUID()}`;
      try {
        const actor = await pool.query(
          `SELECT id FROM "User" WHERE email = $1`,
          ["alice-test@perx.test"],
        );
        await pool.query(
          `INSERT INTO "ConversationEvent" (
          id,
          "conversationId",
          "actorId",
          type,
          snapshot,
          "idempotencyKey",
          "createdAt"
        ) VALUES ($1, $2, $3, 'DEAL_STATUS_CHANGED', 'null'::jsonb, $4, NOW())`,
          [eventId, conversationId, actor.rows[0].id, `legacy-e2e:${eventId}`],
        );
        return eventId;
      } finally {
        await pool.end();
      }
    }

    async function deleteConversationEvent(eventId: string) {
      const { Pool } = await import("pg");
      const pool = new Pool({ connectionString: TEST_DB, ssl: false });
      try {
        await pool.query(`DELETE FROM "ConversationEvent" WHERE id = $1`, [
          eventId,
        ]);
      } finally {
        await pool.end();
      }
    }

    test("Alice authenticates and sees Home feed", async ({ browser }) => {
      const page = await browser.newPage();
      await createSession(page, "alice-test@perx.test");
      await page.goto(`${BASE}/app`);
      await expect(page).not.toHaveURL(/.*sign-in/);
      const bodyText = await page.innerText("body");
      expect(bodyText).not.toContain("PrismaClientInitializationError");
      expect(bodyText).not.toContain("DATABASE_URL");
      await page.close();
    });

    test("Home feed is post-first, paginates, and hides ineligible content", async ({
      browser,
    }) => {
      const fixture = await createHomeFeedFixture("alice-test@perx.test");
      const page = await browser.newPage({
        viewport: { width: 1280, height: 900 },
      });

      try {
        await createSession(page, "alice-test@perx.test");
        await page.goto(`${BASE}/app`);
        await page.waitForLoadState("networkidle");

        const cards = page.locator("[data-post-id]");
        await expect(cards.first()).toBeVisible();

        // Bounded page: a feed request must never return the whole table.
        const initialCount = await cards.count();
        expect(initialCount).toBeGreaterThan(0);
        expect(initialCount).toBeLessThanOrEqual(24);
        const firstId = await cards.first().getAttribute("data-post-id");

        /*
          The feed streams network-then-discovery, so the fixture's authors
          (none of whom are connected to the viewer) only appear once the
          discovery segment loads. Waiting for a specific fixture post proves
          the whole continuation chain worked, not merely that a count grew.
        */
        await expect
          .poll(
            async () => {
              await page.evaluate(() => {
                const main = document.querySelector(".dashboard-main");
                main?.scrollTo({ top: main.scrollHeight });
              });
              return page.locator("[data-post-id]").count();
            },
            { timeout: 30_000 },
          )
          .toBeGreaterThan(initialCount);

        await expect(
          page.getByText(`FeedPost ${fixture.runId} 0`, { exact: true }),
        ).toBeVisible({ timeout: 15_000 });

        // Posts loaded earlier stayed on screen while later pages arrived.
        expect(await cards.first().getAttribute("data-post-id")).toBe(firstId);

        // Deduplication across every appended page.
        const ids = await cards.evaluateAll((nodes) =>
          nodes.map((node) => node.getAttribute("data-post-id")),
        );
        expect(new Set(ids).size).toBe(ids.length);

        // Visibility, asserted only after discovery has actually run: drafts,
        // pending moderation and archived posts must never appear, and B3
        // block semantics must survive the broader discovery query.
        const body = await page.innerText("body");
        expect(body).not.toContain(fixture.hiddenTitlePrefix);
        expect(body).not.toContain(fixture.blockedPostTitle);
      } finally {
        if (!page.isClosed()) await page.close();
        await deleteHomeFeedFixture(fixture);
      }
    });

    test("Home feed survives navigation away and back", async ({ browser }) => {
      const fixture = await createHomeFeedFixture("alice-test@perx.test");
      const page = await browser.newPage({
        viewport: { width: 1280, height: 900 },
      });

      try {
        await createSession(page, "alice-test@perx.test");
        await page.goto(`${BASE}/app`);
        await page.waitForLoadState("networkidle");

        const cards = page.locator("[data-post-id]");
        await expect(cards.first()).toBeVisible();

        await page.evaluate(() => {
          const main = document.querySelector(".dashboard-main");
          main?.scrollTo({ top: main.scrollHeight });
        });
        await expect
          .poll(async () => cards.count(), { timeout: 15_000 })
          .toBeGreaterThan(12);
        const loadedCount = await cards.count();

        await page.goto(`${BASE}/app/profile`);
        await page.waitForLoadState("networkidle");
        await page.goBack();
        await page.waitForLoadState("networkidle");

        // Returning restores the pages already loaded rather than rebuilding
        // the feed from post #1.
        await expect
          .poll(async () => cards.count(), { timeout: 15_000 })
          .toBeGreaterThanOrEqual(loadedCount);
      } finally {
        if (!page.isClosed()) await page.close();
        await deleteHomeFeedFixture(fixture);
      }
    });

    test("Home feed is usable at 320px without horizontal overflow", async ({
      browser,
    }) => {
      const fixture = await createHomeFeedFixture("alice-test@perx.test");
      const page = await browser.newPage({
        viewport: { width: 320, height: 568 },
      });

      try {
        await createSession(page, "alice-test@perx.test");
        await page.goto(`${BASE}/app`);
        await page.waitForLoadState("networkidle");

        const card = page.locator("[data-post-id]").first();
        await expect(card).toBeVisible();

        const overflow = await page.evaluate(
          () =>
            document.documentElement.scrollWidth -
            document.documentElement.clientWidth,
        );
        expect(overflow).toBeLessThanOrEqual(1);

        // Cards must fit the viewport rather than forcing sideways scrolling.
        const box = await card.boundingBox();
        expect(box!.width).toBeLessThanOrEqual(320);

        // Batch 1 bottom navigation still works from the feed.
        const bottomNav = page.getByRole("navigation", {
          name: "Primary navigation",
        });
        await expect(bottomNav).toBeVisible();
        await expect(bottomNav.getByRole("link")).toHaveCount(5);

        // Feed actions remain reachable at accessible touch-target size.
        const save = card.getByRole("button", { name: /Save|Remove from saved/ });
        const saveBox = await save.boundingBox();
        expect(saveBox!.height).toBeGreaterThanOrEqual(40);
      } finally {
        if (!page.isClosed()) await page.close();
        await deleteHomeFeedFixture(fixture);
      }
    });

    test("mobile bottom navigation has 5 destinations at 320px", async ({
      browser,
    }) => {
      const page = await browser.newPage({
        viewport: { width: 320, height: 568 },
      });
      await createSession(page, "alice-test@perx.test");
      await page.goto(`${BASE}/app`);
      await page.waitForLoadState("networkidle");

      const bottomNav = page.getByRole("navigation", {
        name: "Primary navigation",
      });
      await expect(bottomNav).toBeVisible();

      const links = bottomNav.getByRole("link");
      const count = await links.count();
      expect(count).toBe(5);

      // Both the visible text and the accessible name intentionally carry
      // unread badges (e.g. "Messages, 1 unread conversations"), which depend
      // on mailbox state. The destination contract is asserted on the leading
      // name only, so the test stays state-independent.
      const labels = await links.evaluateAll((nodes) =>
        nodes.map((node) =>
          (node.getAttribute("aria-label") ?? node.textContent ?? "")
            .trim()
            .split(",")[0]
            .trim(),
        ),
      );
      // Home leads because the authenticated experience is feed-first, and
      // Create is the prominent centre action rather than a flat tab.
      expect(labels).toEqual([
        "Home",
        "Network",
        "Create",
        "Messages",
        "Profile",
      ]);
      await expect(links.nth(2)).toHaveAttribute("aria-label", "Create");

      // Active state must not rely on colour alone.
      await expect(links.nth(0)).toHaveAttribute("aria-current", "page");
      await expect(links.nth(1)).not.toHaveAttribute("aria-current", "page");
      await page.close();
    });

    test("members without creation capability do not receive create entry points", async ({
      browser,
    }) => {
      const page = await browser.newPage({
        viewport: { width: 390, height: 844 },
      });
      await createSession(page, "carol-test@perx.test");
      await page.goto(`${BASE}/app`);

      const bottomNav = page.getByRole("navigation", {
        name: "Primary navigation",
      });
      await expect(bottomNav.getByRole("link")).toHaveCount(4);
      // The bottom bar labels this destination "Create"; the registry (and the
      // feature directory below) still call it "Create Post".
      await expect(
        bottomNav.getByRole("link", { name: "Create", exact: true }),
      ).toHaveCount(0);
      await page
        .getByRole("button", { name: "Open PerX feature directory" })
        .click();
      await expect(
        page
          .getByRole("dialog", { name: "Explore PerX" })
          .getByText("Create Post", { exact: true }),
      ).toHaveCount(0);

      await page.goto(`${BASE}/app/opportunities/new`);
      await expect(page.getByLabel("Loading workspace")).toBeHidden({
        timeout: 15_000,
      });
      await expect(
        page.getByRole("heading", { name: "What would you like to share?" }),
      ).toHaveCount(0);
      await page.close();
    });

    test("create post is distraction-free, guarded, and responsive", async ({
      browser,
    }) => {
      const page = await browser.newPage({
        viewport: { width: 390, height: 844 },
      });
      await createSession(page, "alice-test@perx.test");
      await page.goto(
        `${BASE}/app/opportunities/new?type=SERVICE&category=services`,
      );

      await expect(
        page.getByRole("heading", { name: "What would you like to share?" }),
      ).toBeVisible();
      await expect(page.locator("header.dashboard-topbar")).toBeHidden();
      await expect(
        page.getByRole("navigation", { name: "Primary navigation" }),
      ).toBeHidden();
      await expect(page.getByLabel("Post type")).toHaveValue("SERVICE");
      const optionalDisclosure = page.getByRole("button", {
        name: "Budget, location and participation",
      });
      await expect(optionalDisclosure).toHaveAttribute(
        "aria-expanded",
        "false",
      );
      await optionalDisclosure.click();
      await expect(page.getByLabel("Budget minimum (NGN)")).toBeVisible();
      await expect(
        page.getByLabel("Post type").getByRole("option", {
          name: "Investment",
        }),
      ).toHaveCount(0);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth + 1,
        ),
      ).toBe(true);

      await page.getByLabel("Post title").fill("Responsive service draft");
      await page.getByRole("button", { name: "Back from Create Post" }).click();
      const confirmation = page.getByRole("dialog", {
        name: "Leave Create Post?",
      });
      await expect(confirmation).toBeVisible();
      await expect(
        confirmation.getByRole("button", { name: "Cancel" }),
      ).toBeFocused();
      await confirmation.getByRole("button", { name: "Cancel" }).click();
      await expect(page.getByLabel("Post title")).toHaveValue(
        "Responsive service draft",
      );
      await page.close();
    });

    test("create post progressively discloses relevant fields on mobile", async ({
      browser,
    }) => {
      const page = await browser.newPage({
        viewport: { width: 375, height: 812 },
      });
      await createSession(page, "alice-test@perx.test");
      try {
        await page.goto(
          `${BASE}/app/opportunities/new?type=SERVICE&category=services`,
        );
        await expect(page.getByLabel("Property type")).toHaveCount(0);
        await expect(page.getByLabel("Budget minimum (NGN)")).toBeHidden();
        await expect(page.getByLabel("Location")).toBeHidden();
        await expect(page.getByLabel("Skills or expertise")).toBeHidden();
        await page
          .getByRole("button", { name: "Budget, location and participation" })
          .click();
        await expect(page.getByLabel("Budget minimum (NGN)")).toBeVisible();
        await expect(page.getByLabel("Location")).toBeVisible();
        await expect(page.getByLabel("Skills or expertise")).toBeVisible();
        await expect(
          page.getByLabel("Remote participation is supported"),
        ).toBeVisible();

        // The Real Estate vertical is retired. A stale link carrying the
        // retired type/category must fall back to a live type instead of
        // reopening the property composer.
        // See docs/implementation/REAL_ESTATE_RETIREMENT.md.
        await page.goto(
          `${BASE}/app/opportunities/new?type=PROPERTY&category=real-estate`,
        );
        await expect(page.getByLabel("Property type")).toHaveCount(0);
        await expect(page.getByLabel("Listing type")).toHaveCount(0);
        await expect(page.getByLabel("Contact preference")).toHaveCount(0);
        await expect(
          page.getByLabel("Ownership or authority declaration"),
        ).toHaveCount(0);
        await expect(page.getByLabel("Post type")).toHaveValue(
          "FREELANCE_PROJECT",
        );
        await expect(
          page.getByLabel("Post type").getByRole("option", {
            name: "Property",
          }),
        ).toHaveCount(0);
        await expect(
          page.getByLabel("Post type").getByRole("option", {
            name: "Investment",
          }),
        ).toHaveCount(0);
        expect(
          await page
            .locator(".dashboard-main")
            .evaluate((element) => element.scrollHeight > element.clientHeight),
        ).toBe(true);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth + 1,
          ),
        ).toBe(true);
      } finally {
        await page.close();
      }
    });

    test("create post draft recovery is bounded, isolated, and resilient", async ({
      browser,
    }) => {
      const page = await browser.newPage({
        viewport: { width: 390, height: 844 },
      });
      const aliceId = await createSession(page, "alice-test@perx.test");
      const serviceKey = opportunityDraftKey(aliceId, "SERVICE");
      const productKey = opportunityDraftKey(aliceId, "PRODUCT");
      const serviceTitle = `Restored service ${crypto.randomUUID()}`;
      const productTitle = `Restored product ${crypto.randomUUID()}`;
      const serviceDraft = {
        fields: browserDraftFields("SERVICE", serviceTitle),
        savedAt: Date.now(),
        type: "SERVICE",
        version: 1,
      };
      try {
        await page.goto(
          `${BASE}/app/opportunities/new?type=SERVICE&category=services`,
        );
        await page.evaluate(
          ({ key, value }) =>
            window.localStorage.setItem(key, JSON.stringify(value)),
          { key: serviceKey, value: serviceDraft },
        );
        await page.reload();
        await expect(page.getByLabel("Post title")).toHaveValue(serviceTitle);
        /*
          The restore message is transient by design: the composer announces
          "Restored local draft", then its 450ms autosave timer fires and
          replaces it with "Saved locally". Asserting the intermediate value
          alone made this test depend on Playwright polling inside that window,
          which produced intermittent failures.

          Both strings prove the draft was recovered - the field value assertion
          above is what actually verifies the restored content - so either
          settled state is accepted.
        */
        await expect(
          page.getByRole("status", { name: "Local draft status" }),
        ).toHaveText(/Restored local draft|Saved locally/);

        await page.goto(
          `${BASE}/app/opportunities/new?type=PRODUCT&category=market`,
        );
        await expect(page.getByLabel("Post title")).toHaveValue("");
        await page.getByLabel("Post title").fill(productTitle);
        await expect
          .poll(() =>
            page.evaluate(
              (key) => window.localStorage.getItem(key),
              productKey,
            ),
          )
          .toContain(productTitle);
        await page.goto(
          `${BASE}/app/opportunities/new?type=SERVICE&category=services`,
        );
        await expect(page.getByLabel("Post title")).toHaveValue(serviceTitle);

        await page.evaluate(
          ({ key, value }) =>
            window.localStorage.setItem(key, JSON.stringify(value)),
          {
            key: serviceKey,
            value: {
              ...serviceDraft,
              savedAt: Date.now() - 31 * 24 * 60 * 60 * 1000,
            },
          },
        );
        await page.reload();
        await expect(page.getByLabel("Post title")).toHaveValue("");

        await page.evaluate(
          (key) => window.localStorage.setItem(key, "{"),
          serviceKey,
        );
        await page.reload();
        await expect(
          page.getByRole("heading", { name: "What would you like to share?" }),
        ).toBeVisible();
        // The composer reads (and purges) the stored draft in a queued
        // microtask after mount, so the removal is observed by polling rather
        // than by reading storage on the same tick as the heading assertion.
        await expect
          .poll(
            () =>
              page.evaluate(
                (key) => window.localStorage.getItem(key),
                serviceKey,
              ),
            { timeout: 10_000 },
          )
          .toBeNull();

        await page.evaluate(
          (key) => window.localStorage.setItem(key, "x".repeat(16_001)),
          serviceKey,
        );
        await page.reload();
        await expect(page.getByLabel("Post title")).toHaveValue("");
        await expect
          .poll(
            () =>
              page.evaluate(
                (key) => window.localStorage.getItem(key),
                serviceKey,
              ),
            { timeout: 10_000 },
          )
          .toBeNull();

        await page.evaluate(() => {
          Storage.prototype.setItem = () => {
            throw new DOMException("Quota exceeded", "QuotaExceededError");
          };
        });
        await page.getByLabel("Post title").fill("Quota-safe draft");
        await expect(page.getByRole("status", { name: "Local draft status" })).toHaveText(
          "Local autosave is unavailable",
        );

        await page.reload();
        await page.evaluate(
          ({ key, value }) =>
            window.localStorage.setItem(key, JSON.stringify(value)),
          { key: serviceKey, value: serviceDraft },
        );
        await page.context().clearCookies();
        await createSession(page, "bob-test@perx.test");
        await page.goto(
          `${BASE}/app/opportunities/new?type=SERVICE&category=services`,
        );
        await expect(page.getByLabel("Post title")).toHaveValue("");
      } finally {
        await page.close();
      }
    });

    test("MoneyInput keeps canonical values and server rejects invalid budgets", async ({
      browser,
    }) => {
      const page = await browser.newPage({
        viewport: { width: 390, height: 844 },
      });
      const userId = await createSession(page, "alice-test@perx.test");
      const storageKey = opportunityDraftKey(userId, "SERVICE");
      try {
        await page.goto(
          `${BASE}/app/opportunities/new?type=SERVICE&category=services`,
        );
        await page
          .getByRole("button", { name: "Budget, location and participation" })
          .click();
        const input = page.getByLabel("Budget minimum (NGN)");
        await input.fill("250000.50");
        await expect(input).toHaveValue("250000.50");
        await expect(input.locator("xpath=preceding-sibling::span")).toHaveText(
          "NGN",
        );

        for (const value of ["1,234", "-1", "92233720368547758.08"]) {
          const invalidTitle = `Invalid budget ${crypto.randomUUID()}`;
          await page.evaluate(
            (key) => window.localStorage.removeItem(key),
            storageKey,
          );
          await page.goto(
            `${BASE}/app/opportunities/new?type=SERVICE&category=services`,
          );
          await page
            .getByRole("button", { name: "Budget, location and participation" })
            .click();
          await fillRequiredPost(page, invalidTitle);
          await page.getByLabel("Budget minimum (NGN)").fill(value);
          await page.getByRole("button", { name: "Save draft" }).click();
          await expect(page).toHaveURL(
            /\/app\/opportunities\/new\?error=check-fields&type=SERVICE&category=services/,
          );
          await expect(page.getByLabel("Post type")).toHaveValue("SERVICE");
          await expect(page.getByLabel("Category")).toHaveValue("services");
          await expect(page.getByLabel("Post title")).toHaveValue(invalidTitle);
          await expect(page.getByLabel("Budget minimum (NGN)")).toHaveValue(
            value,
          );
          expect(
            await page.evaluate(
              (key) => window.localStorage.getItem(key),
              storageKey,
            ),
          ).not.toBeNull();
        }
      } finally {
        await page.close();
      }
    });

    test("create post clears only its scoped browser draft after confirmed persistence", async ({
      browser,
    }, testInfo) => {
      test.skip(
        testInfo.project.name !== "chromium",
        "This persistence scenario mutates isolated Opportunity data once.",
      );
      test.setTimeout(120_000);
      const title = `Scoped browser draft ${crypto.randomUUID()}`;
      const page = await browser.newPage();
      try {
        const userId = await createSession(page, "alice-test@perx.test");
        const storageKey = opportunityDraftKey(userId, "SERVICE");
        const unrelatedKey = opportunityDraftKey(userId, "PRODUCT");
        await page.goto(
          `${BASE}/app/opportunities/new?type=SERVICE&category=services`,
        );
        await page.evaluate(
          ({ key, value }) => window.localStorage.setItem(key, value),
          { key: unrelatedKey, value: "unrelated-product-draft" },
        );
        await page.getByLabel("Post title").fill(title);
        await page
          .getByLabel("Short summary")
          .fill("A complete scoped browser draft for persistence proof.");
        await page
          .getByLabel("Details")
          .fill(
            "This complete service description proves that browser recovery remains available until the server confirms a persisted Opportunity and redirects to the authenticated success destination.",
          );
        await page
          .getByLabel("Budget minimum (NGN)")
          .fill("92233720368547758.07");
        await expect
          .poll(() =>
            page.evaluate(
              (key) => window.localStorage.getItem(key),
              storageKey,
            ),
          )
          .toContain(title);

        await page.getByRole("button", { name: "Save draft" }).click();
        await expect(page).toHaveURL(
          /\/app\/manage\?created=[^&]+&createdType=SERVICE/,
          { timeout: 30_000 },
        );
        await expect(page.getByText("Post created")).toBeVisible();
        const createdId = new URL(page.url()).searchParams.get("created");
        expect(createdId).toBeTruthy();
        const { Pool } = await import("pg");
        const pool = new Pool({ connectionString: TEST_DB, ssl: false });
        try {
          const persisted = await pool.query<{
            budgetMinMinor: string;
            ownerId: string;
            status: string;
            type: string;
          }>(
            `SELECT "budgetMinMinor"::text AS "budgetMinMinor", "ownerId", status, type
             FROM "Opportunity"
             WHERE id = $1 AND title = $2`,
            [createdId, title],
          );
          expect(persisted.rows).toEqual([
            {
              budgetMinMinor: "9223372036854775807",
              ownerId: userId,
              status: "DRAFT",
              type: "SERVICE",
            },
          ]);
        } finally {
          await pool.end();
        }
        await expect
          .poll(() =>
            page.evaluate(
              (key) => window.localStorage.getItem(key),
              storageKey,
            ),
          )
          .toBeNull();
        expect(
          await page.evaluate(
            (key) => window.localStorage.getItem(key),
            unrelatedKey,
          ),
        ).toBe("unrelated-product-draft");
      } finally {
        try {
          await deleteOpportunityByTitle(title);
        } finally {
          if (!page.isClosed()) await page.close();
        }
      }
    });

    test("feature directory keeps search visible without forcing focus", async ({
      browser,
    }) => {
      const page = await browser.newPage({
        viewport: { width: 390, height: 844 },
      });
      await createSession(page, "alice-test@perx.test");
      await page.goto(`${BASE}/app`);
      await page
        .getByRole("button", { name: "Open PerX feature directory" })
        .click();

      const search = page.getByLabel("Search PerX features");
      const close = page.getByRole("button", {
        name: "Close feature directory",
      });
      await expect(search).toBeVisible();
      await expect(close).toBeFocused();
      await expect(search).not.toBeFocused();
      await page.close();
    });

    test("profile page has no horizontal overflow at 320px", async ({
      browser,
    }) => {
      const page = await browser.newPage({
        viewport: { width: 320, height: 568 },
      });
      await createSession(page, "alice-test@perx.test");
      await page.goto(`${BASE}/app/profile`);
      await page.waitForLoadState("networkidle");

      const scrollWidth = await page.evaluate(
        () => document.documentElement.scrollWidth,
      );
      const clientWidth = await page.evaluate(
        () => document.documentElement.clientWidth,
      );
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
      await page.close();
    });

    test("long public profile exposes complete persisted content on mobile", async ({
      browser,
    }) => {
      const fixture = await createLongProfileFixture();
      const page = await browser.newPage({
        viewport: { width: 320, height: 568 },
      });
      try {
        await page.goto(`${BASE}/u/bob_test`);
        await expect(
          page.getByRole("heading", { name: "Portfolio" }),
        ).toBeVisible();
        await expect(page.getByText("Trust workflow platform")).toBeVisible();
        await expect(page.getByText("Jan 2024 - Present")).toBeVisible();
        await expect(
          page.getByRole("link", { name: "Website" }),
        ).toHaveAttribute("href", "https://example.com/bob-profile");
        const dimensions = await page.evaluate(() => ({
          clientHeight: document.documentElement.clientHeight,
          clientWidth: document.documentElement.clientWidth,
          scrollHeight: document.documentElement.scrollHeight,
          scrollWidth: document.documentElement.scrollWidth,
        }));
        expect(dimensions.scrollHeight).toBeGreaterThan(
          dimensions.clientHeight,
        );
        expect(dimensions.scrollWidth).toBeLessThanOrEqual(
          dimensions.clientWidth + 1,
        );

        await page
          .locator('[data-profile-end="true"]')
          .scrollIntoViewIfNeeded();
        await expect(
          page.locator('[data-profile-end="true"]'),
        ).toBeInViewport();
        expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
      } finally {
        await page.close();
        await deleteLongProfileFixture(fixture);
      }
    });

    test("profile Trust presentation is evidence-based and notifications are filterable", async ({
      browser,
    }) => {
      const page = await browser.newPage({
        viewport: { width: 390, height: 844 },
      });
      await createSession(page, "alice-test@perx.test");

      await page.goto(`${BASE}/u/bob_test`);
      await expect(page.getByText("Numeric score not published")).toBeVisible();
      await expect(page.getByText("Evidence overview")).toBeVisible();
      await expect(page.getByText(/Authoritative score/)).toHaveCount(0);

      await page.goto(`${BASE}/app/notifications`);
      await expect(
        page.getByRole("navigation", { name: "Notification filters" }),
      ).toBeVisible();
      await expect(page.getByRole("link", { name: "Reviews" })).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth + 1,
        ),
      ).toBe(true);
      await page.close();
    });

    test("notification pagination preserves equal timestamps, filters, and browser history", async ({
      browser,
    }) => {
      const notificationPrefix = await createNotificationPaginationFixture();
      // The fixture namespaces every title with a unique run prefix so parallel
      // or repeated runs cannot collide; assertions must use that same prefix.
      const { titlePrefix } = notificationPrefix;
      const page = await browser.newPage();
      try {
        await createSession(page, "alice-test@perx.test");
        await page.goto(`${BASE}/app/notifications?type=messages`);

        await expect(
          page.getByText(`${titlePrefix} message 052`),
        ).toBeVisible();
        await expect(
          page.getByText(`${titlePrefix} message 003`),
        ).toBeVisible();
        await expect(
          page.getByText(`${titlePrefix} message 002`),
        ).toHaveCount(0);
        await expect(
          page.getByText(`${titlePrefix} system sentinel`),
        ).toHaveCount(0);
        const firstPageUrl = page.url();

        const olderLink = page.getByRole("link", {
          name: "Older notifications",
        });
        await expect(olderLink).toHaveAttribute(
          "href",
          /type=messages&cursor=/,
        );
        const olderHref = await olderLink.getAttribute("href");
        expect(olderHref).toBeTruthy();
        await page.goto(new URL(olderHref!, BASE).href);
        expect(new URL(page.url()).searchParams.get("type")).toBe("messages");
        expect(new URL(page.url()).searchParams.get("cursor")).toBeTruthy();
        await expect(
          page.getByText(`${titlePrefix} message 002`),
        ).toBeVisible();
        await expect(
          page.getByText(`${titlePrefix} message 001`),
        ).toBeVisible();
        await expect(
          page.getByText(`${titlePrefix} message 003`),
        ).toHaveCount(0);
        const olderPageUrl = page.url();

        await page.goBack();
        await expect(page).toHaveURL(firstPageUrl, { timeout: 30_000 });
        await expect(
          page.getByText(`${titlePrefix} message 052`),
        ).toBeVisible();

        await page.goForward();
        await expect(page).toHaveURL(olderPageUrl, { timeout: 30_000 });
        await expect(
          page.getByText(`${titlePrefix} message 001`),
        ).toBeVisible();
      } finally {
        await page.close();
        await deleteNotificationPaginationFixture(notificationPrefix.ids);
      }
    });

    test("search page loads and shows results", async ({ browser }) => {
      const page = await browser.newPage();
      await createSession(page, "alice-test@perx.test");
      await page.goto(`${BASE}/app/search`);
      await page.waitForLoadState("networkidle");

      const bodyText = await page.innerText("body");
      expect(bodyText).toContain("Search");
      expect(bodyText).not.toContain("PrismaClientInitializationError");
      await page.close();
    });

    test("connections page loads with tabs", async ({ browser }) => {
      const page = await browser.newPage();
      await createSession(page, "alice-test@perx.test");
      await page.goto(`${BASE}/app/connections`);
      await page.waitForLoadState("networkidle");

      const bodyText = await page.innerText("body");
      expect(bodyText).toContain("Discover People");
      expect(bodyText).toContain("Connection Requests");
      expect(bodyText).toContain("My Connections");
      await page.close();
    });

    test("messages page loads for authenticated user", async ({ browser }) => {
      const page = await browser.newPage({
        locale: "fr-FR",
        timezoneId: "America/New_York",
      });
      const pageErrors: string[] = [];
      page.on("pageerror", (error) => pageErrors.push(error.message));
      await createSession(page, "alice-test@perx.test");
      await page.goto(`${BASE}/app/messages`);
      await expect(page.getByLabel("Message workspace")).toBeVisible();

      const bodyText = await page.innerText("body");
      expect(bodyText).toContain("Messages");
      expect(bodyText).not.toContain("PrismaClientInitializationError");

      const composer = page.locator("#message-draft");
      if (!(await composer.isVisible())) {
        await page
          .getByLabel("Conversation list")
          .locator('[data-conversation-list-scroll="true"] > button')
          .first()
          .click();
      }
      await expect(composer).toBeVisible();
      await composer.fill("Keyboard contract check");
      await composer.press("Enter");
      await expect(composer).toHaveValue("Keyboard contract check\n");
      await composer.press("Control+Enter");
      await expect(composer).toHaveValue("");
      await expect(
        page
          .locator("[data-message-id]")
          .getByText("Keyboard contract check", { exact: true })
          .last(),
      ).toBeVisible();

      const conversationSearch = page.getByPlaceholder(
        "Search people or conversations",
      );
      if (!(await conversationSearch.isVisible())) {
        await page
          .getByRole("button", { name: "Back to conversations" })
          .click();
      }
      await expect(conversationSearch).toBeVisible();
      await conversationSearch.fill("No matching participant 404");
      await expect(page.getByText("No conversations found")).toBeVisible();
      expect(pageErrors).toEqual([]);
      await page.close();
    });

    test("in-chat Make a Deal creates one submitted locked Proposal", async ({
      browser,
    }, testInfo) => {
      test.skip(
        testInfo.project.name !== "chromium",
        "This structured Proposal scenario mutates its own isolated fixture once.",
      );
      test.setTimeout(120_000);
      const fixture = await createConversationDealEntryFixture();
      const page = await browser.newPage();
      const terms = `In-chat Deal terms ${crypto.randomUUID()} covering the exact keyboard condition, delivery handoff, and acceptance criteria.`;
      const { Pool } = await import("pg");
      const pool = new Pool({ connectionString: TEST_DB, ssl: false });

      try {
        const before = await pool.query<{ updatedAt: Date }>(
          `SELECT "updatedAt" FROM "Conversation" WHERE id = $1`,
          [fixture.conversationId],
        );
        await createSession(page, "alice-test@perx.test");
        await page.goto(`${BASE}/app/messages/${fixture.conversationId}`);

        await expect(page.getByLabel("Message workspace")).toBeVisible();
        await expect(page.getByText("Live", { exact: true })).toBeVisible({
          timeout: 30_000,
        });
        await page.getByRole("button", { name: "Make a Deal" }).click();
        const dialog = page.getByRole("dialog", { name: "Make a Deal" });
        await expect(dialog).toBeVisible();
        await expect(dialog).toContainText(
          `Send locked terms to ${fixture.bobName} for ${fixture.opportunityTitle}`,
        );
        await expect(dialog).toContainText(
          "A Deal is created only if the other participant accepts this exact version.",
        );
        await expect(dialog).toContainText(
          "Payments are currently unavailable. This Deal records agreed terms but does not hold funds.",
        );
        const submittedFields = await dialog
          .locator("form")
          .evaluate((form) =>
            [...new FormData(form as HTMLFormElement).keys()].sort(),
          );
        expect(submittedFields).toEqual([
          "amount",
          "deliveryDays",
          "description",
          "revisions",
        ]);
        expect(submittedFields).not.toContain("participantId");
        expect(submittedFields).not.toContain("userId");

        await dialog.getByLabel("Agreement amount (NGN)").fill("275000.00");
        await dialog.getByLabel("Delivery days").fill("10");
        await dialog.getByLabel("Included revisions").fill("2");
        await dialog.getByLabel("Proposal terms").fill(terms);
        await dialog.getByRole("button", { name: "Submit proposal" }).click();

        await expect(dialog).toBeHidden({ timeout: 30_000 });
        await expect(
          page.getByText("Proposal submitted", { exact: true }),
        ).toBeVisible();
        const eventCard = page
          .getByRole("heading", {
            level: 3,
            name: "Proposal version 1 submitted",
          })
          .locator("xpath=ancestor::article[1]");
        await expect(eventCard).toContainText(terms);
        await expect(eventCard).toContainText("NGN");
        await expect(eventCard).toContainText(
          "This submitted version is locked. Any term change requires a new numbered revision.",
        );
        await expect(
          page.getByRole("button", { name: "Make a Deal" }),
        ).toHaveCount(0);
        await expect(page).toHaveURL(
          `${BASE}/app/messages/${fixture.conversationId}`,
        );

        const result = await pool.query<{
          amountMinor: string;
          auditCount: number;
          conversationUpdatedAt: Date;
          dealCount: number;
          deliveryDays: number;
          eventCount: number;
          eventSnapshot: Record<string, unknown>;
          eventType: string;
          notificationCount: number;
          notificationRecipientId: string;
          participantIds: string[];
          proposalId: string;
          proposalStatus: string;
          revisions: number;
          versionId: string;
          versionStatus: string;
        }>(
          `SELECT proposal.id AS "proposalId",
                  proposal.status AS "proposalStatus",
                  proposal."amountMinor"::text AS "amountMinor",
                  proposal."deliveryDays",
                  proposal.revisions,
                  version.id AS "versionId",
                  version.status AS "versionStatus",
                  event.type AS "eventType",
                  event.snapshot AS "eventSnapshot",
                  conversation."updatedAt" AS "conversationUpdatedAt",
                  ARRAY(
                    SELECT participant."userId"
                    FROM "ConversationParticipant" participant
                    WHERE participant."conversationId" = conversation.id
                    ORDER BY participant."userId"
                  ) AS "participantIds",
                  (SELECT COUNT(*)::int FROM "Deal" deal
                    WHERE deal."proposalId" = proposal.id) AS "dealCount",
                  (SELECT COUNT(*)::int FROM "ConversationEvent" candidate
                    WHERE candidate."conversationId" = conversation.id
                      AND candidate."proposalVersionId" = version.id) AS "eventCount",
                  (SELECT COUNT(*)::int FROM "Notification" notification
                    WHERE notification.metadata->>'proposalVersionId' = version.id
                      AND notification."userId" = $3) AS "notificationCount",
                  (SELECT notification."userId" FROM "Notification" notification
                    WHERE notification.metadata->>'proposalVersionId' = version.id
                    ORDER BY notification."createdAt", notification.id LIMIT 1)
                    AS "notificationRecipientId",
                  (SELECT COUNT(*)::int FROM "AuditLog" audit
                    WHERE audit."entityId" = version.id
                      AND audit.action = 'proposal.version_submitted'
                      AND audit.metadata->>'source' = 'conversation_make_deal')
                    AS "auditCount"
           FROM "Proposal" proposal
           JOIN "ProposalVersion" version ON version."proposalId" = proposal.id
           JOIN "ConversationEvent" event
             ON event."proposalVersionId" = version.id
            AND event.type = 'PROPOSAL_SUBMITTED'
           JOIN "Conversation" conversation
             ON conversation.id = proposal."conversationId"
           WHERE proposal."conversationId" = $1
             AND proposal.description = $2`,
          [fixture.conversationId, terms, fixture.bobId],
        );
        expect(result.rows).toHaveLength(1);
        expect(result.rows[0]).toMatchObject({
          amountMinor: "27500000",
          auditCount: 1,
          dealCount: 0,
          deliveryDays: 10,
          eventCount: 1,
          eventType: "PROPOSAL_SUBMITTED",
          notificationCount: 1,
          notificationRecipientId: fixture.bobId,
          proposalStatus: "SENT",
          revisions: 2,
          versionStatus: "SUBMITTED",
        });
        expect(result.rows[0]!.participantIds).toEqual(
          [fixture.aliceId, fixture.bobId].sort(),
        );
        expect(result.rows[0]!.eventSnapshot).toMatchObject({
          amountMinor: "27500000",
          deliveryDays: 10,
          description: terms,
          includedRevisions: 2,
          opportunityTitle: fixture.opportunityTitle,
          versionNumber: 1,
        });
        expect(result.rows[0]!.conversationUpdatedAt.getTime()).toBeGreaterThan(
          before.rows[0]!.updatedAt.getTime(),
        );

        const proposalNavigation = page.waitForURL(/\/app\/proposals\/sent/);
        await eventCard.getByRole("link", { name: "Review proposal" }).click();
        await proposalNavigation;
        await page.reload();
        await expect(
          page.getByRole("heading", { name: "Proposals sent" }),
        ).toBeVisible();
        const lockedVersion = page
          .getByText(terms, { exact: true })
          .locator("xpath=ancestor::article[1]");
        await expect(lockedVersion).toContainText("Locked version 1", {
          timeout: 30_000,
        });
        await expect(
          lockedVersion.locator("input, textarea, select, button"),
        ).toHaveCount(0);
      } finally {
        await pool.end();
        if (!page.isClosed()) await page.close();
        await deleteConversationDealEntryFixture(fixture.conversationId);
      }
    });

    test("exact @deal requires explicit submission and remains idempotent", async ({
      browser,
    }, testInfo) => {
      test.skip(
        testInfo.project.name !== "chromium",
        "This command scenario mutates its own isolated Proposal fixture once.",
      );
      test.setTimeout(120_000);
      const fixture = await createConversationDealEntryFixture();
      const page = await browser.newPage();
      const terms = `Command Deal terms ${crypto.randomUUID()} with explicit delivery, scope, and acceptance conditions.`;
      const { Pool } = await import("pg");
      const pool = new Pool({ connectionString: TEST_DB, ssl: false });
      try {
        await createSession(page, "alice-test@perx.test");
        await page.goto(`${BASE}/app/messages/${fixture.conversationId}`);
        const composer = page.locator("#message-draft");

        await composer.fill("hello @deal");
        await page.getByRole("button", { name: "Send message" }).click();
        await expect(
          page.getByText("hello @deal", { exact: true }).last(),
        ).toBeVisible();
        await expect(
          page.getByRole("dialog", { name: "Make a Deal" }),
        ).toHaveCount(0);

        await composer.fill("  @DeAl  ");
        await page.getByRole("button", { name: "Send message" }).click();
        const dialog = page.getByRole("dialog", { name: "Make a Deal" });
        await expect(dialog).toBeVisible();
        await expect(composer).toHaveValue("  @DeAl  ");
        const beforeSubmit = await pool.query<{ proposals: number }>(
          `SELECT COUNT(*)::int AS proposals
           FROM "Proposal" WHERE "conversationId" = $1`,
          [fixture.conversationId],
        );
        expect(beforeSubmit.rows[0]!.proposals).toBe(0);

        await dialog.getByLabel("Agreement amount (NGN)").fill("125000.25");
        await dialog.getByLabel("Delivery days").fill("8");
        await dialog.getByLabel("Included revisions").fill("1");
        await dialog.getByLabel("Proposal terms").fill(terms);
        await dialog
          .getByRole("button", { name: "Submit proposal" })
          .evaluate((button: HTMLButtonElement) => {
            button.form?.requestSubmit(button);
            button.form?.requestSubmit(button);
          });
        await expect(dialog).toBeHidden({ timeout: 30_000 });
        await expect(composer).toHaveValue("");

        const persisted = await pool.query<{
          audits: number;
          commandMessages: number;
          events: number;
          notifications: number;
          proposals: number;
          versions: number;
        }>(
          `SELECT
             (SELECT COUNT(*)::int FROM "Proposal"
               WHERE "conversationId" = $1 AND description = $2) AS proposals,
             (SELECT COUNT(*)::int FROM "ProposalVersion" version
               JOIN "Proposal" proposal ON proposal.id = version."proposalId"
               WHERE proposal."conversationId" = $1) AS versions,
             (SELECT COUNT(*)::int FROM "ConversationEvent"
               WHERE "conversationId" = $1 AND type = 'PROPOSAL_SUBMITTED') AS events,
             (SELECT COUNT(*)::int FROM "Notification"
               WHERE metadata->>'conversationId' = $1
                 AND metadata->>'proposalId' IS NOT NULL) AS notifications,
             (SELECT COUNT(*)::int FROM "AuditLog"
               WHERE metadata->>'conversationId' = $1
                 AND action = 'proposal.version_submitted') AS audits,
             (SELECT COUNT(*)::int FROM "Message"
               WHERE "conversationId" = $1
                 AND LOWER(BTRIM(body)) = '@deal') AS "commandMessages"`,
          [fixture.conversationId, terms],
        );
        expect(persisted.rows).toEqual([
          {
            audits: 1,
            commandMessages: 0,
            events: 1,
            notifications: 1,
            proposals: 1,
            versions: 1,
          },
        ]);
        await expect(
          page.getByRole("button", { name: "Make a Deal" }),
        ).toHaveCount(0);
      } finally {
        await pool.end();
        if (!page.isClosed()) await page.close();
        await deleteConversationDealEntryFixture(fixture.conversationId);
      }
    });

    test("conversation authorization and blocks prevent Proposal creation", async ({
      browser,
    }, testInfo) => {
      test.skip(
        testInfo.project.name !== "chromium",
        "This policy scenario uses isolated direct-conversation fixtures.",
      );
      const unauthorizedFixture = await createConversationDealEntryFixture();
      const blockedFixture = await createConversationDealEntryFixture();
      const unauthorizedPage = await browser.newPage();
      const blockedPage = await browser.newPage();
      let blockId: string | null = null;
      const { Pool } = await import("pg");
      const pool = new Pool({ connectionString: TEST_DB, ssl: false });
      try {
        await createSession(unauthorizedPage, "carol-test@perx.test");
        const unauthorizedResponse = await unauthorizedPage.goto(
          `${BASE}/app/messages/${unauthorizedFixture.conversationId}`,
        );
        expect(unauthorizedResponse?.status()).toBe(404);
        await expect(
          unauthorizedPage.getByRole("button", { name: "Make a Deal" }),
        ).toHaveCount(0);
        await expect(
          unauthorizedPage.getByText(
            "Use the structured terms entry when you are ready.",
          ),
        ).toHaveCount(0);

        blockId = await createBlockedPairFixture(
          blockedFixture.bobId,
          blockedFixture.aliceId,
        );
        await createSession(blockedPage, "alice-test@perx.test");
        const blockedResponse = await blockedPage.goto(
          `${BASE}/app/messages/${blockedFixture.conversationId}`,
        );
        // `buildConversationAccessWhere` excludes conversations where either
        // participant has blocked the other, so a blocked participant is
        // unauthorized for the conversation and the route must answer 404
        // rather than rendering a workspace that offers Proposal entry.
        expect(blockedResponse?.status()).toBe(404);
        await expect(
          blockedPage.getByRole("button", { name: "Make a Deal" }),
        ).toHaveCount(0);
        await expect(
          blockedPage.getByRole("dialog", { name: "Make a Deal" }),
        ).toHaveCount(0);
        await expect(
          blockedPage.getByText(
            "Use the structured terms entry when you are ready.",
          ),
        ).toHaveCount(0);
        const count = await pool.query<{ proposals: number }>(
          `SELECT COUNT(*)::int AS proposals
           FROM "Proposal" WHERE "conversationId" = ANY($1::text[])`,
          [[unauthorizedFixture.conversationId, blockedFixture.conversationId]],
        );
        expect(count.rows[0]!.proposals).toBe(0);
      } finally {
        await pool.end();
        if (!unauthorizedPage.isClosed()) await unauthorizedPage.close();
        if (!blockedPage.isClosed()) await blockedPage.close();
        await deleteBlockedPairFixture(blockId);
        await deleteConversationDealEntryFixture(
          unauthorizedFixture.conversationId,
        );
        await deleteConversationDealEntryFixture(blockedFixture.conversationId);
      }
    });

    test("legacy event data renders without a Server Component failure", async ({
      browser,
    }) => {
      const conversationId = await getSeedConversationId();
      const eventId = await insertLegacyConversationEvent(conversationId);
      const page = await browser.newPage();
      const pageErrors: string[] = [];
      page.on("pageerror", (error) => pageErrors.push(error.message));
      await createSession(page, "alice-test@perx.test");

      try {
        const response = await page.goto(
          `${BASE}/app/messages/${conversationId}?event=${eventId}`,
        );
        expect(response?.status()).toBe(200);
        await expect(page.getByLabel("Message workspace")).toBeVisible();
        await expect(
          page.locator(`[data-event-id="${eventId}"]`),
        ).toHaveAttribute("aria-current", "true");
        await expect(page.getByText("Workspace Unavailable")).toHaveCount(0);
        await expect(
          page.getByText("Messages are temporarily unavailable"),
        ).toHaveCount(0);
        expect(pageErrors).toEqual([]);
      } finally {
        await page.close();
        await deleteConversationEvent(eventId);
      }
    });

    test("chat profile preview scrolls without losing conversation state", async ({
      browser,
    }, testInfo) => {
      test.skip(
        testInfo.project.name !== "chromium",
        "This test owns the profile fixture and exercises all required widths directly.",
      );
      test.setTimeout(180_000);
      const profileFixture = await createLongProfileFixture();
      const messageFixture = await createMessageInteractionFixture();
      try {
        for (const width of [320, 375, 430, 768, 1023, 1024, 1280]) {
          const page = await browser.newPage({
            viewport: { height: width === 320 ? 568 : 700, width },
          });
          try {
            await createSession(page, "alice-test@perx.test");
            await page.goto(
              `${BASE}/app/messages/${messageFixture.conversationId}`,
            );
            const history = page.getByLabel("Message history");
            const composer = page.locator("#message-draft");
            const incoming = page.locator(
              `[data-message-id="${messageFixture.incomingId}"]`,
            );
            const own = page.locator(
              `[data-message-id="${messageFixture.ownEditId}"]`,
            );
            await expect(history).toBeVisible();
            await expect(incoming).toBeAttached();
            await expect(own).toBeAttached();

            await incoming.scrollIntoViewIfNeeded();
            await incoming.getByLabel("Message actions").click();
            await page
              .getByRole("menuitem", { name: "Reply" })
              .evaluate((element) => (element as HTMLButtonElement).click());
            await own.scrollIntoViewIfNeeded();
            await own.getByLabel("Message actions").click();
            await page
              .getByRole("menuitem", { name: "Edit" })
              .evaluate((element) => (element as HTMLButtonElement).click());
            await composer.fill(`Profile scroll draft ${width}`);
            await history.evaluate((element) => {
              element.scrollTop = Math.min(
                300,
                Math.max(1, element.scrollHeight - element.clientHeight - 100),
              );
              element.dispatchEvent(new Event("scroll"));
            });
            const historyScrollBefore = await history.evaluate(
              (element) => element.scrollTop,
            );
            await page
              .getByRole("button", { name: "Open conversation details" })
              .click();

            const dialog = page.getByRole("dialog", {
              name: "Profile preview",
            });
            const scroller = dialog.locator(
              '[data-profile-preview-scroll="true"]',
            );
            const end = dialog.locator('[data-profile-preview-end="true"]');
            const close = dialog.getByRole("button", {
              name: "Close profile preview",
            });
            await expect(dialog).toBeVisible();
            await expect(close).toBeVisible();
            const dimensions = await scroller.evaluate((element) => ({
              clientHeight: element.clientHeight,
              scrollHeight: element.scrollHeight,
              scrollTop: element.scrollTop,
            }));
            expect(dimensions.scrollHeight).toBeGreaterThan(
              dimensions.clientHeight,
            );
            await scroller.evaluate((element) => {
              element.scrollTop = element.scrollHeight;
              element.dispatchEvent(new Event("scroll"));
            });
            await expect
              .poll(() => scroller.evaluate((element) => element.scrollTop))
              .toBeGreaterThan(dimensions.scrollTop);
            await expect(end).toBeInViewport();
            await expect(close).toBeVisible();
            expect(await history.evaluate((element) => element.scrollTop)).toBe(
              historyScrollBefore,
            );

            await close.click();
            await expect(dialog).toBeHidden();
            expect(await history.evaluate((element) => element.scrollTop)).toBe(
              historyScrollBefore,
            );
            await expect(composer).toHaveValue(`Profile scroll draft ${width}`);
            await expect(
              page.getByText(`Replying to ${messageFixture.bobName}`),
            ).toBeVisible();
            await expect(page.getByLabel("Edit message")).toHaveValue(
              "Gesture own edit target",
            );
          } finally {
            await page.close();
          }
        }
      } finally {
        await deleteIsolatedConversation(messageFixture.conversationId);
        await deleteLongProfileFixture(profileFixture);
      }
    });

    test("desktop message menus expose eligible actions and feedback", async ({
      browser,
    }, testInfo) => {
      test.skip(
        testInfo.project.name !== "chromium",
        "This message mutation scenario owns an isolated fixture.",
      );
      const fixture = await createMessageInteractionFixture();
      const context = await browser.newContext({
        permissions: ["clipboard-read", "clipboard-write"],
        viewport: { height: 800, width: 1280 },
      });
      const page = await context.newPage();
      try {
        await createSession(page, "alice-test@perx.test");
        await page.goto(`${BASE}/app/messages/${fixture.conversationId}`);
        const incoming = page.locator(
          `[data-message-id="${fixture.incomingId}"]`,
        );
        const ownEdit = page.locator(
          `[data-message-id="${fixture.ownEditId}"]`,
        );
        const ownDelete = page.locator(
          `[data-message-id="${fixture.ownDeleteId}"]`,
        );
        const expiredOwn = page.locator(
          `[data-message-id="${fixture.expiredOwnId}"]`,
        );
        const trigger = incoming.getByLabel("Message actions");

        // The conversation timeline streams in; wait for the target message to
        // exist before interacting, otherwise the first hover/click races the
        // client render and the test stalls on a not-yet-mounted control.
        await expect(incoming).toBeAttached({ timeout: 30_000 });
        await incoming.scrollIntoViewIfNeeded();

        // Radix DropdownMenu is modal: while open it disables pointer events
        // outside the menu, so Playwright's actionability check can never
        // resolve for the covered trigger/header. Closing therefore uses the
        // menu's real dismissal affordances (Escape / outside pointerdown)
        // rather than an actionable click on an intentionally covered element.
        await trigger.click();
        await expect(trigger).toHaveAttribute("aria-expanded", "true");
        await page.keyboard.press("Escape");
        await expect(trigger).toHaveAttribute("aria-expanded", "false");

        await trigger.click();
        await expect(trigger).toHaveAttribute("aria-expanded", "true");
        await page
          .locator(".message-conversation-header")
          .dispatchEvent("pointerdown");
        await expect(trigger).toHaveAttribute("aria-expanded", "false");

        await incoming.hover();
        await expect(incoming.getByLabel("Reply")).toBeVisible();
        await expect(incoming.getByLabel("Copy")).toBeVisible();
        await expect(incoming.getByLabel("Edit")).toHaveCount(0);
        await expect(incoming.getByLabel("Remove message")).toHaveCount(0);
        await incoming.getByLabel("Copy").click();
        await expect(
          page.getByText("Message copied", { exact: true }),
        ).toBeVisible();

        await ownEdit.hover();
        await expect(ownEdit.getByLabel("Edit")).toBeVisible();
        await expect(ownEdit.getByLabel("Remove message")).toBeVisible();
        await ownEdit.getByLabel("Edit").click();
        await page.getByLabel("Edit message").fill("Gesture edit persisted");
        await page.getByRole("button", { name: "Save", exact: true }).click();
        await expect(
          page.getByText("Message updated", { exact: true }),
        ).toBeVisible();
        await expect(ownEdit).toContainText("Gesture edit persisted");

        await ownDelete.hover();
        await ownDelete.getByLabel("Remove message").click();
        const confirmation = page.getByRole("dialog", {
          name: "Remove this message for everyone?",
        });
        await confirmation
          .getByRole("button", { name: "Remove message" })
          .click();
        await expect(
          page.getByText("Message removed", { exact: true }),
        ).toBeVisible();
        await expect(ownDelete).toContainText(
          "This message was removed from the chat view.",
        );
        await expect(expiredOwn.getByLabel("Edit")).toHaveCount(0);
        await expect(expiredOwn.getByLabel("Remove message")).toHaveCount(0);
      } finally {
        await context.close();
        await deleteIsolatedConversation(fixture.conversationId);
      }
    });

    test("mobile long press and swipe reply obey gesture boundaries", async ({
      browser,
    }, testInfo) => {
      test.skip(
        testInfo.project.name !== "chromium",
        "This test creates its own touch context and isolated conversation.",
      );
      const fixture = await createMessageInteractionFixture();
      const context = await browser.newContext({
        hasTouch: true,
        isMobile: true,
        viewport: { height: 844, width: 390 },
      });
      const page = await context.newPage();
      const { Pool } = await import("pg");
      const pool = new Pool({ connectionString: TEST_DB, ssl: false });
      try {
        await createSession(page, "alice-test@perx.test");
        await page.goto(`${BASE}/app/messages/${fixture.conversationId}`);
        const incoming = page.locator(
          `[data-message-id="${fixture.incomingId}"]`,
        );
        const replyBubble = page.locator(
          `[data-message-id="${fixture.replyId}"]`,
        );
        const trigger = incoming.getByLabel("Message actions");
        await expect(incoming).toBeAttached();

        await dispatchTouch(incoming, "touchstart", 20, 20);
        await page.waitForTimeout(550);
        await expect(trigger).toHaveAttribute("aria-expanded", "true");
        await dispatchTouch(incoming, "touchend", 20, 20);
        await expect(
          page.getByText(`Replying to ${fixture.bobName}`),
        ).toHaveCount(0);
        await page.keyboard.press("Escape");

        await dispatchTouch(incoming, "touchstart", 20, 20);
        await dispatchTouch(incoming, "touchmove", 36, 20);
        await page.waitForTimeout(550);
        await dispatchTouch(incoming, "touchend", 36, 20);
        await expect(trigger).toHaveAttribute("aria-expanded", "false");

        await dispatchTouch(incoming, "touchstart", 20, 20);
        await dispatchTouch(incoming, "touchmove", 22, 55);
        await page.waitForTimeout(550);
        await dispatchTouch(incoming, "touchend", 22, 55);
        await expect(trigger).toHaveAttribute("aria-expanded", "false");

        const nativeContextPrevented = await incoming.evaluate((element) => {
          const event = new MouseEvent("contextmenu", {
            bubbles: true,
            cancelable: true,
          });
          element.dispatchEvent(event);
          return event.defaultPrevented;
        });
        expect(nativeContextPrevented).toBe(true);
        await expect(trigger).toHaveAttribute("aria-expanded", "true");
        await page.keyboard.press("Escape");

        const before = await pool.query<{ messages: number }>(
          `SELECT COUNT(*)::int AS messages
           FROM "Message" WHERE "conversationId" = $1`,
          [fixture.conversationId],
        );
        await dispatchTouch(incoming, "touchstart", 10, 40);
        await dispatchTouch(incoming, "touchmove", 100, 43);
        await page.waitForTimeout(50);
        await dispatchTouch(incoming, "touchend", 100, 43);
        await expect(
          page.getByText(`Replying to ${fixture.bobName}`),
        ).toBeVisible();
        await expect(page.locator("#message-draft")).toHaveValue("");
        const after = await pool.query<{ messages: number }>(
          `SELECT COUNT(*)::int AS messages
           FROM "Message" WHERE "conversationId" = $1`,
          [fixture.conversationId],
        );
        expect(after.rows[0]!.messages).toBe(before.rows[0]!.messages);
        await page.getByLabel("Cancel reply").click();

        const interactiveReply = replyBubble.getByRole("button").first();
        await dispatchTouch(interactiveReply, "touchstart", 20, 20);
        await page.waitForTimeout(550);
        await dispatchTouch(interactiveReply, "touchmove", 100, 22);
        await dispatchTouch(interactiveReply, "touchend", 100, 22);
        await expect(
          page.getByText(`Replying to ${fixture.bobName}`),
        ).toHaveCount(0);
        await expect(replyBubble.getByLabel("Message actions")).toHaveAttribute(
          "aria-expanded",
          "false",
        );
      } finally {
        await pool.end();
        await context.close();
        await deleteIsolatedConversation(fixture.conversationId);
      }
    });

    test("mobile active chat is immersive and app navigation preserves state", async ({
      browser,
    }, testInfo) => {
      test.skip(
        testInfo.project.name !== "chromium",
        "This isolated scenario creates its own explicit mobile viewport.",
      );
      const mobileWidth = Number(process.env.PERX_MESSAGES_TEST_WIDTH ?? 320);
      const mobileHeight =
        mobileWidth === 430 ? 932 : mobileWidth === 375 ? 812 : 568;
      const conversationId = await createIsolatedConversation(32);
      const page = await browser.newPage({
        viewport: { width: mobileWidth, height: mobileHeight },
      });
      const pageErrors: string[] = [];
      page.on("pageerror", (error) => pageErrors.push(error.message));
      try {
        await createSession(page, "alice-test@perx.test");
        await page.goto(`${BASE}/app/messages`);

        const primaryNavigation = page.getByRole("navigation", {
          name: "Primary navigation",
        });
        await expect(primaryNavigation).toBeVisible();
        const messagesDestination = primaryNavigation.getByRole("link", {
          name: /Messages/,
        });
        await expect(messagesDestination).toHaveAttribute(
          "aria-current",
          "page",
        );

        const list = page.getByLabel("Conversation list");
        const conversationSearch = page.getByPlaceholder(
          "Search people or conversations",
        );
        await conversationSearch.fill("Bob");
        const listScroller = list.locator(
          '[data-conversation-list-scroll="true"]',
        );
        const listScrollBefore = await listScroller.evaluate(
          (element) => element.scrollTop,
        );
        const conversationButton = list.locator(
          `[data-conversation-id="${conversationId}"]`,
        );
        const historyBeforeOpen = await page.evaluate(
          () => window.history.length,
        );
        const syncResponsePromise = page.waitForResponse(
          (response) =>
            response.url().includes("/api/messages/sync?") &&
            response
              .url()
              .includes(`conversationId=${encodeURIComponent(conversationId)}`),
        );
        await conversationButton.click();
        expect((await syncResponsePromise).ok()).toBe(true);

        const workspace = page.getByLabel("Message workspace");
        await expect(workspace).toHaveAttribute(
          "data-mobile-view",
          "conversation",
        );
        await expect(primaryNavigation).toBeHidden();
        await expect(page.locator("header.dashboard-topbar")).toBeHidden();
        await expect(
          page.getByRole("button", { name: "Back to conversations" }),
        ).toBeVisible();
        expect(await page.evaluate(() => window.history.length)).toBe(
          historyBeforeOpen + 1,
        );
        await expect(
          page.locator(".message-conversation-header"),
        ).toBeFocused();

        for (const control of [
          page.getByRole("button", { name: "Back to conversations" }),
          page.getByRole("button", { name: "Show app navigation" }),
          page.getByRole("button", { name: "Open conversation details" }),
        ]) {
          const controlBox = await control.boundingBox();
          expect(controlBox).not.toBeNull();
          expect(controlBox!.width).toBeGreaterThanOrEqual(44);
          expect(controlBox!.height).toBeGreaterThanOrEqual(44);
        }

        const workspaceBox = await workspace.boundingBox();
        expect(workspaceBox).not.toBeNull();
        expect(Math.abs(workspaceBox!.y)).toBeLessThanOrEqual(1);
        expect(workspaceBox!.height).toBeGreaterThanOrEqual(mobileHeight - 1);
        expect(workspaceBox!.height).toBeLessThanOrEqual(mobileHeight + 1);

        const composer = page.locator("#message-draft");
        const history = page.getByLabel("Message history");
        await expect
          .poll(() =>
            history.evaluate(
              (element) => element.scrollHeight - element.clientHeight,
            ),
          )
          .toBeGreaterThan(400);
        await history.evaluate((element) => {
          element.scrollTop = Math.max(
            0,
            element.scrollHeight - element.clientHeight - 320,
          );
          element.dispatchEvent(new Event("scroll"));
        });
        await composer.fill("Draft remains while app navigation is open");
        const historyDistanceBefore = await history.evaluate(
          (element) =>
            element.scrollHeight - element.scrollTop - element.clientHeight,
        );
        const historyBeforeOverlay = await page.evaluate(
          () => window.history.length,
        );
        await page.getByRole("button", { name: "Show app navigation" }).click();

        const appNavigation = page.getByRole("dialog", {
          name: "App navigation",
        });
        await expect(appNavigation).toBeVisible();
        await expect(
          appNavigation.getByRole("link", { name: /Go to Home/ }),
        ).toBeVisible();
        await expect(
          appNavigation.getByRole("link", { name: /Messages/ }),
        ).toHaveAttribute("aria-current", "page");
        await expect(appNavigation).not.toContainText("Hello from Alice!");
        await expect(composer).toHaveValue(
          "Draft remains while app navigation is open",
        );
        expect(await page.evaluate(() => window.history.length)).toBe(
          historyBeforeOverlay,
        );

        await appNavigation
          .getByRole("button", { name: "Hide app navigation" })
          .click();
        await expect(
          page.getByRole("button", { name: "Show app navigation" }),
        ).toBeFocused();
        await expect(composer).toHaveValue(
          "Draft remains while app navigation is open",
        );
        await expect
          .poll(() =>
            history.evaluate(
              (element) =>
                element.scrollHeight - element.scrollTop - element.clientHeight,
            ),
          )
          .toBe(historyDistanceBefore);

        const sentBody = `Immersive mobile message ${crypto.randomUUID()}`;
        await composer.fill(sentBody);
        await page.getByRole("button", { name: "Send message" }).click();
        await expect(
          page
            .locator("[data-message-id]")
            .getByText(sentBody, { exact: true })
            .last(),
        ).toBeVisible();

        const composerBox = await page
          .getByRole("form", { name: "Message composer" })
          .boundingBox();
        expect(composerBox).not.toBeNull();
        expect(composerBox!.y + composerBox!.height).toBeLessThanOrEqual(
          mobileHeight,
        );
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth + 1,
          ),
        ).toBe(true);

        await page
          .getByRole("button", { name: "Back to conversations" })
          .click();
        await expect(workspace).toHaveAttribute("data-mobile-view", "list");
        await expect(primaryNavigation).toBeVisible();
        await expect(conversationButton).toBeFocused();
        await expect(conversationSearch).toHaveValue("Bob");
        expect(
          await listScroller.evaluate((element) => element.scrollTop),
        ).toBe(listScrollBefore);
        await conversationButton.click();
        await expect(workspace).toHaveAttribute(
          "data-mobile-view",
          "conversation",
        );
        await page.evaluate(() => window.history.back());
        await expect(workspace).toHaveAttribute("data-mobile-view", "list");
        await expect(conversationSearch).toHaveValue("Bob");
        await page.evaluate(() => window.history.forward());
        await expect(workspace).toHaveAttribute(
          "data-mobile-view",
          "conversation",
          { timeout: 15_000 },
        );
        await page.evaluate(() => window.history.back());
        await expect(workspace).toHaveAttribute("data-mobile-view", "list");
        expect(pageErrors).toEqual([]);
      } finally {
        await page.close();
        await deleteIsolatedConversation(conversationId);
      }
    });

    test("mobile chat opens at latest and exposes jump recovery", async ({
      browser,
    }, testInfo) => {
      test.skip(
        testInfo.project.name !== "chromium",
        "This isolated scenario creates its own explicit mobile viewport.",
      );
      test.setTimeout(120_000);
      const conversationId = await createIsolatedConversation(40);
      const alicePage = await browser.newPage({
        viewport: { width: 390, height: 844 },
      });
      await createSession(alicePage, "alice-test@perx.test");

      try {
        await alicePage.goto(`${BASE}/app/messages/${conversationId}`);
        const history = alicePage.getByLabel("Message history");
        await expect(history).toBeVisible();
        await expect(history).toHaveAttribute("data-history-positioned", "true", {
          timeout: 15_000,
        });
        await expect
          .poll(
            async () =>
              history.evaluate(
                (element) =>
                  element.scrollHeight - element.scrollTop - element.clientHeight,
              ),
            { timeout: 15_000 },
          )
          .toBeLessThanOrEqual(72);

        await alicePage
          .getByRole("button", { name: "Open conversation details" })
          .click();
        const profileDialog = alicePage.getByRole("dialog", {
          name: "Profile preview",
        });
        await expect(profileDialog).toBeVisible();
        await expect(
          profileDialog.locator('[data-profile-preview-scroll="true"]'),
        ).toHaveCSS("overflow-y", "auto");
        await profileDialog
          .getByRole("button", { name: "Close profile preview" })
          .click();

        await history.hover();
        await alicePage.mouse.wheel(0, -10_000);
        await expect(
          alicePage.getByRole("button", {
            name: "Jump to latest messages",
            exact: true,
          }),
        ).toBeVisible();

        await alicePage
          .getByRole("button", {
            name: "Jump to latest messages",
            exact: true,
          })
          .click();
        await expect
          .poll(async () =>
            history.evaluate(
              (element) =>
                element.scrollHeight - element.scrollTop - element.clientHeight,
            ),
          )
          .toBeLessThanOrEqual(72);
      } finally {
        await alicePage.close();
        await deleteIsolatedConversation(conversationId);
      }
    });

    test("direct conversations stay immersive across mobile and tablet widths", async ({
      browser,
    }, testInfo) => {
      test.skip(
        testInfo.project.name !== "chromium",
        "This isolated scenario exercises every required viewport directly.",
      );
      const conversationId = await createIsolatedConversation(4);
      try {
        for (const viewport of [
          { width: 375, height: 812 },
          { width: 430, height: 932 },
          { width: 768, height: 1024 },
          { width: 1023, height: 900 },
        ]) {
          const page = await browser.newPage({ viewport });
          try {
            await createSession(page, "alice-test@perx.test");
            const response = await page.goto(
              `${BASE}/app/messages/${conversationId}`,
            );
            expect(response?.status()).toBe(200);

            const workspace = page.getByLabel("Message workspace");
            await expect(workspace).toHaveAttribute(
              "data-mobile-view",
              "conversation",
            );
            await expect(
              page.getByRole("navigation", { name: "Primary navigation" }),
            ).toBeHidden();
            await expect(
              page.getByRole("link", { name: "Back to conversations" }),
            ).toBeVisible();
            await expect(
              page.getByRole("button", { name: "Show app navigation" }),
            ).toBeVisible();
            const box = await workspace.boundingBox();
            expect(box).not.toBeNull();
            expect(Math.abs(box!.y)).toBeLessThanOrEqual(1);
            expect(box!.height).toBeGreaterThanOrEqual(viewport.height - 1);
            expect(box!.height).toBeLessThanOrEqual(viewport.height + 1);
            expect(
              await page.evaluate(
                () =>
                  document.documentElement.scrollWidth <= window.innerWidth + 1,
              ),
            ).toBe(true);

            const composer = page.locator("#message-draft");
            const defaultComposerHeight = await composer.evaluate(
              (element) => element.getBoundingClientRect().height,
            );
            const longUrl = `https://perx.test/${"unbroken".repeat(40)}`;
            await composer.fill(
              `A long message that must wrap within the mobile composer ${longUrl}`,
            );
            await expect
              .poll(() =>
                composer.evaluate(
                  (element) => element.getBoundingClientRect().height,
                ),
              )
              .toBeGreaterThan(defaultComposerHeight);
            const wrappingState = await composer.evaluate((element) => {
              const style = window.getComputedStyle(element);
              const box = element.getBoundingClientRect();
              return {
                overflowWrap: style.overflowWrap,
                overflowX: style.overflowX,
                right: box.right,
                scrollWidth: element.scrollWidth,
                width: box.width,
              };
            });
            expect(wrappingState.overflowWrap).toBe("anywhere");
            expect(wrappingState.overflowX).toBe("hidden");
            expect(wrappingState.right).toBeLessThanOrEqual(viewport.width);
            expect(wrappingState.scrollWidth).toBeLessThanOrEqual(
              wrappingState.width + 1,
            );
            expect(
              await page.evaluate(
                () =>
                  document.documentElement.scrollWidth <= window.innerWidth + 1,
              ),
            ).toBe(true);

            await composer.fill(
              Array.from(
                { length: 20 },
                (_, index) => `Line ${index + 1}`,
              ).join("\n"),
            );
            await expect
              .poll(() =>
                composer.evaluate((element) => ({
                  clientHeight: element.clientHeight,
                  overflowY: window.getComputedStyle(element).overflowY,
                  scrollHeight: element.scrollHeight,
                })),
              )
              .toEqual(
                expect.objectContaining({
                  clientHeight: 144,
                  overflowY: "auto",
                }),
              );
            expect(
              await composer.evaluate(
                (element) => element.scrollHeight > element.clientHeight,
              ),
            ).toBe(true);

            if (viewport.width === 375) {
              const multilineBody = `Mobile multiline ${crypto.randomUUID()}\nSecond line`;
              await composer.fill(multilineBody);
              const expandedHeight = await composer.evaluate(
                (element) => element.getBoundingClientRect().height,
              );
              await page.getByRole("button", { name: "Send message" }).click();
              await expect(composer).toHaveValue("");
              await expect
                .poll(() =>
                  composer.evaluate(
                    (element) => element.getBoundingClientRect().height,
                  ),
                )
                .toBe(defaultComposerHeight);
              expect(expandedHeight).toBeGreaterThan(defaultComposerHeight);
              await expect(
                page
                  .locator("[data-message-id]")
                  .getByText(multilineBody, { exact: true })
                  .last(),
              ).toBeVisible();
            }

            await composer.fill("");
            await expect
              .poll(() =>
                composer.evaluate(
                  (element) => element.getBoundingClientRect().height,
                ),
              )
              .toBe(defaultComposerHeight);

            if (viewport.width === 430) {
              await page.setViewportSize({ width: 430, height: 700 });
              const resizedBox = await workspace.boundingBox();
              expect(resizedBox).not.toBeNull();
              expect(resizedBox!.height).toBeGreaterThanOrEqual(699);
              const composerBox = await page
                .getByRole("textbox", { name: "Message", exact: true })
                .boundingBox();
              expect(composerBox).not.toBeNull();
              expect(composerBox!.y + composerBox!.height).toBeLessThanOrEqual(
                700,
              );
            }

            if (viewport.width === 375) {
              await composer.fill("Direct-route draft");
            }

            await page
              .getByRole("link", { name: "Back to conversations" })
              .click();
            await expect(page).toHaveURL(/\/app\/messages$/, {
              timeout: 15_000,
            });
            await expect(
              page.getByRole("navigation", { name: "Primary navigation" }),
            ).toBeVisible();
            await page.getByLabel("Conversation list").waitFor();
            if (viewport.width === 375) {
              await expect(page.getByLabel("Conversation list")).toContainText(
                "Direct-route draft",
              );
            }
          } finally {
            await page.close();
          }
        }
      } finally {
        await deleteIsolatedConversation(conversationId);
      }
    });

    test("desktop conversation navigation remains unchanged", async ({
      browser,
    }) => {
      const conversationId = await getSeedConversationId();
      for (const width of [1024, 1280]) {
        const page = await browser.newPage({
          viewport: { width, height: 900 },
        });
        await createSession(page, "alice-test@perx.test");
        await page.goto(`${BASE}/app/messages/${conversationId}`);

        await expect(
          page.getByRole("navigation", { name: "Sidebar navigation" }),
        ).toBeVisible();
        await expect(page.locator("header.dashboard-topbar")).toBeVisible();
        await expect(
          page.getByRole("navigation", { name: "Primary navigation" }),
        ).toBeHidden();
        await expect(page.getByLabel("Conversation list")).toBeVisible();
        await expect(page.getByLabel("Active conversation")).toBeVisible();
        await expect(
          page.getByRole("button", { name: "Show app navigation" }),
        ).toBeHidden();
        await page.close();
      }
    });

    test("draft proposal becomes a locked version and an exact-version Deal", async ({
      browser,
    }, testInfo) => {
      test.skip(
        testInfo.project.name !== "chromium",
        "This viewport-independent lifecycle scenario mutates isolated Deal data.",
      );
      test.setTimeout(180_000);
      const scope = `Acceptance flow ${testInfo.project.name} ${crypto.randomUUID()} with locked scope, delivery criteria, and a numbered revision history.`;
      const alicePage = await browser.newPage();
      await createSession(alicePage, "alice-test@perx.test");
      await alicePage.goto(`${BASE}/opportunities/bob-mech-keyboard`);
      await alicePage.getByLabel("Proposed amount").fill("250000.00");
      await alicePage.getByLabel("Delivery period").fill("10");
      await alicePage.getByLabel("Revisions").fill("2");
      await alicePage.getByLabel("Proposal").fill(scope);
      const saveDraftButton = alicePage.getByRole("button", {
        name: "Save draft",
      });
      const proposalForm = saveDraftButton.locator("xpath=ancestor::form[1]");
      expect(
        await proposalForm.evaluate((form: HTMLFormElement) =>
          form.checkValidity(),
        ),
      ).toBe(true);
      const draftResponsePromise = alicePage.waitForResponse(
        (response) =>
          response.request().method() === "POST" &&
          response.url().includes("/opportunities/bob-mech-keyboard"),
      );
      const draftDestinationPromise = alicePage.waitForURL(
        /\/app\/proposals\/sent/,
      );
      await saveDraftButton.click();
      const draftResponse = await draftResponsePromise;
      expect(draftResponse.status()).toBeLessThan(400);
      await draftDestinationPromise;
      await alicePage.waitForLoadState("networkidle");
      const draftEditor = alicePage
        .locator('textarea[name="description"]')
        .filter({ hasText: scope })
        .first();
      await expect(draftEditor).toHaveValue(scope);
      const sentProposalCard = draftEditor.locator(
        "xpath=ancestor::section[1]",
      );
      const submitResponsePromise = alicePage.waitForResponse(
        (response) =>
          response.request().method() === "POST" &&
          response.url().includes("/app/proposals/sent"),
      );
      await sentProposalCard
        .getByRole("button", { name: /Submit and lock v/ })
        .click();
      expect((await submitResponsePromise).status()).toBeLessThan(400);
      await expect(alicePage).toHaveURL(/\/app\/messages\//, {
        timeout: 30_000,
      });
      await expect(alicePage.getByText(scope, { exact: true })).toBeVisible();
      await expect(
        alicePage.getByText(/submitted version is locked/i),
      ).toBeVisible();
      await alicePage.goto(`${BASE}/app/proposals/sent`);
      await alicePage.waitForLoadState("networkidle");
      const lockedProposalCard = alicePage
        .getByText(scope, { exact: true })
        .locator("xpath=ancestor::section[1]");
      const createRevisionButton = lockedProposalCard.getByRole("button", {
        name: "Create revision",
      });
      const revisionRequestPromise = alicePage.waitForRequest(
        (request) =>
          request.method() === "POST" &&
          request.url().includes("/app/proposals/sent"),
      );
      await createRevisionButton.evaluate((button: HTMLButtonElement) => {
        button.form?.requestSubmit(button);
      });
      expect(
        (await (await revisionRequestPromise).response())?.status(),
      ).toBeLessThan(400);
      const revisionEditor = alicePage
        .locator('textarea[name="description"]')
        .filter({ hasText: scope })
        .first();
      await expect(revisionEditor).toHaveValue(scope, { timeout: 30_000 });
      await expect(
        revisionEditor
          .locator("xpath=ancestor::section[1]")
          .getByText("Editable draft · v2"),
      ).toBeVisible();
      await alicePage.close();

      const bobPage = await browser.newPage();
      await createSession(bobPage, "bob-test@perx.test");
      await bobPage.goto(`${BASE}/app/proposals/received`);
      await bobPage.waitForLoadState("networkidle");
      await expect(bobPage.getByText(scope, { exact: true })).toHaveCount(1);
      const proposalCard = bobPage
        .getByText(scope, { exact: true })
        .locator("xpath=ancestor::section[1]");
      const acceptButton = proposalCard.getByRole("button", {
        name: "Accept exact version",
      });
      const formMetadata = await acceptButton.evaluate(
        (button: HTMLButtonElement) => ({
          action: button.form?.getAttribute("action"),
          fieldNames: button.form ? [...new FormData(button.form).keys()] : [],
          hasForm: Boolean(button.form),
          method: button.form?.method,
        }),
      );
      expect(formMetadata.hasForm).toBe(true);
      expect(formMetadata.method).toBe("post");
      expect(formMetadata.fieldNames).toContain("versionId");
      expect(
        formMetadata.fieldNames.some((name) => name.startsWith("$ACTION_ID_")),
      ).toBe(true);
      const acceptRequestPromise = bobPage.waitForRequest(
        (request) =>
          request.method() === "POST" &&
          request.url().includes("/app/proposals/received"),
        { timeout: 30_000 },
      );
      await acceptButton.evaluate((button: HTMLButtonElement) => {
        button.form?.requestSubmit(button);
      });
      const acceptResponse = await (await acceptRequestPromise).response();
      expect(acceptResponse?.status()).toBeLessThan(400);
      await expect(bobPage).toHaveURL(/\/app\/deals\//, { timeout: 30_000 });
      await expect(
        bobPage.getByText("Online payment unavailable"),
      ).toBeVisible();
      // A newly created Deal uses PROVIDER_DISABLED settlement, whose
      // disclosure reads "does not hold funds". The "collected, held,
      // transferred, or released" wording belongs to legacy SIMULATED deals.
      await expect(
        bobPage.getByText(/does not hold funds/i).first(),
      ).toBeVisible();
      const dealUrl = bobPage.url();

      await bobPage.goto(`${BASE}/app/proposals/received`);
      await expect(bobPage.getByText(scope, { exact: true })).toHaveCount(1);

      await bobPage.goto(`${dealUrl}/deliveries`);
      await expect(
        bobPage.getByText(
          "Only the assigned provider can submit milestone work.",
        ),
      ).toBeVisible();

      const aliceDeliveryPage = await browser.newPage();
      await createSession(aliceDeliveryPage, "alice-test@perx.test");
      await aliceDeliveryPage.goto(`${dealUrl}/deliveries`);
      await aliceDeliveryPage.waitForLoadState("networkidle");
      await aliceDeliveryPage.getByLabel("Title").fill("Acceptance delivery");
      await aliceDeliveryPage
        .getByLabel("Notes")
        .fill("Completed the exact locked scope for the acceptance test.");
      const submitDeliveryButton = aliceDeliveryPage.getByRole("button", {
        name: "Submit delivery",
      });
      const deliveryRequestPromise = aliceDeliveryPage.waitForRequest(
        (request) =>
          request.method() === "POST" && request.url().includes("/deliveries"),
      );
      await submitDeliveryButton.evaluate((button: HTMLButtonElement) => {
        button.form?.requestSubmit(button);
      });
      expect(
        (await (await deliveryRequestPromise).response())?.status(),
      ).toBeLessThan(400);
      await expect(aliceDeliveryPage).toHaveURL(new RegExp(`${dealUrl}$`), {
        timeout: 30_000,
      });
      await aliceDeliveryPage.close();

      await bobPage.goto(`${dealUrl}/deliveries`);
      await bobPage.waitForLoadState("networkidle");
      const approveButton = bobPage.getByRole("button", {
        name: "Approve submitted milestone",
      });
      const approvalRequestPromise = bobPage.waitForRequest(
        (request) =>
          request.method() === "POST" && request.url().includes("/deliveries"),
      );
      await approveButton.evaluate((button: HTMLButtonElement) => {
        button.form?.requestSubmit(button);
      });
      expect(
        (await (await approvalRequestPromise).response())?.status(),
      ).toBeLessThan(400);
      await expect(bobPage).toHaveURL(new RegExp(`${dealUrl}$`), {
        timeout: 30_000,
      });

      const dealId = new URL(dealUrl).pathname.split("/").at(-1)!;
      const { Pool } = await import("pg");
      const pool = new Pool({ connectionString: TEST_DB, ssl: false });
      try {
        const result = await pool.query(
          `SELECT d.status,
                d."settlementMode",
                COUNT(DISTINCT r.id)::int AS releases,
                ARRAY_AGG(DISTINCT v.status::text) AS version_statuses
         FROM "Deal" d
         LEFT JOIN "Release" r ON r."dealId" = d.id
         JOIN "ProposalVersion" v ON v."proposalId" = d."proposalId"
         WHERE d.id = $1
         GROUP BY d.id`,
          [dealId],
        );
        expect(result.rows[0]).toMatchObject({
          releases: 0,
          settlementMode: "PROVIDER_DISABLED",
          status: "APPROVED",
        });
        expect(result.rows[0].version_statuses).toEqual(
          expect.arrayContaining(["ACCEPTED", "WITHDRAWN"]),
        );
      } finally {
        await pool.end();
      }
      await bobPage.close();
    });

    test("news page loads for authenticated user", async ({ browser }) => {
      const page = await browser.newPage();
      await createSession(page, "alice-test@perx.test");
      await page.goto(`${BASE}/app/news`);
      await page.waitForLoadState("networkidle");

      const bodyText = await page.innerText("body");
      expect(bodyText).toContain("News");
      expect(bodyText).not.toContain("PrismaClientInitializationError");
      await page.close();
    });

    test("services page shows published service from another user", async ({
      browser,
    }) => {
      const page = await browser.newPage();
      await createSession(page, "bob-test@perx.test");
      await page.goto(`${BASE}/app/services`);
      await page.waitForLoadState("networkidle");

      const bodyText = await page.innerText("body");
      expect(bodyText).not.toContain("PrismaClientInitializationError");
      await page.close();
    });

    test("carol cannot access admin moderation route", async ({ browser }) => {
      const page = await browser.newPage();
      await createSession(page, "carol-test@perx.test");
      const response = await page.goto(`${BASE}/admin`);
      expect(response?.status()).toBe(404);
      await page.close();
    });

    test("MASTER_ADMIN sees read-only user and Deal summaries", async ({
      browser,
    }) => {
      const fixture = await createAdminUsersBrowserFixture();
      const page = await browser.newPage();
      await createSession(page, "admin-test@perx.test");
      const { Pool } = await import("pg");
      const pool = new Pool({ connectionString: TEST_DB, ssl: false });

      try {
        let response = await page.goto(`${BASE}/admin/users`);
        expect(response?.status()).toBe(200);
        let main = page.locator("main");
        await expect(
          main.getByRole("heading", { level: 1, name: "Users" }),
        ).toBeVisible();
        await expect(main.locator("article")).toHaveCount(20);
        const restrictedUser = main
          .getByRole("heading", { level: 2, name: fixture.restrictedName })
          .locator("xpath=ancestor::article[1]");
        await expect(restrictedUser).toContainText("active");
        await expect(restrictedUser).toContainText("unverified");
        await expect(restrictedUser).toContainText("Member");
        await expect(restrictedUser).toContainText(
          "messaging restricted until",
        );
        await expect(restrictedUser).toContainText(
          "connection requests restricted until",
        );
        await expect(restrictedUser).toContainText(
          "publishing restricted until",
        );
        await expect(main.locator('a[href^="/admin/users/"]')).toHaveCount(0);
        await expect(
          main.locator(
            "article a, article form, article input, article select, article textarea, article button",
          ),
        ).toHaveCount(0);
        const firstPayload = await page.content();
        for (const secret of [
          fixture.passwordHash,
          fixture.privateMessageBody,
          fixture.sessionHash,
          fixture.storageKey,
        ]) {
          expect(firstPayload).not.toContain(secret);
        }
        expect(firstPayload).not.toContain("DATABASE_URL");
        expect(firstPayload).not.toContain("SUPABASE_SERVICE_ROLE_KEY");

        const pagination = main.getByRole("navigation", {
          name: "Admin users pagination",
        });
        await expect(
          pagination.getByRole("link", { name: "Next" }),
        ).toBeVisible();
        await pagination.getByRole("link", { name: "Next" }).click();
        await expect(page).toHaveURL(/\/admin\/users\?cursor=/);
        main = page.locator("main");
        expect(await main.locator("article").count()).toBeLessThanOrEqual(20);
        const adminUser = main
          .getByRole("heading", { level: 2, name: "Admin Test" })
          .locator("xpath=ancestor::article[1]");
        await expect(adminUser).toContainText(
          "@admin_test · admin-test@perx.test",
        );
        await expect(
          adminUser.getByText("active", { exact: true }),
        ).toBeVisible();
        await expect(
          adminUser.getByText("verified", { exact: true }),
        ).toBeVisible();
        await expect(
          adminUser.getByText("Master Admin", { exact: true }),
        ).toBeVisible();
        await expect(adminUser).toContainText(
          /\d+ opportunities · \d+ completed agreements · \d+ public reviews/,
        );
        await expect(
          main
            .getByRole("navigation", { name: "Admin users pagination" })
            .getByRole("link", { name: "First page" }),
        ).toBeVisible();

        const dealRecord = await pool.query<{
          id: string;
          proposalDescription: string;
          versionDescription: string;
        }>(
          `SELECT deal.id,
                  proposal.description AS "proposalDescription",
                  version.description AS "versionDescription"
           FROM "Deal" deal
           JOIN "Proposal" proposal ON proposal.id = deal."proposalId"
           JOIN "ProposalVersion" version ON version.id = deal."proposalVersionId"
           JOIN "DealParticipant" participant ON participant."dealId" = deal.id
           JOIN "User" participant_user ON participant_user.id = participant."userId"
           WHERE deal.status = 'APPROVED'
             AND deal."valueMinor" = 100000
             AND participant_user.email = 'bob-test@perx.test'
           ORDER BY deal."updatedAt", deal.id
           LIMIT 1`,
        );
        expect(dealRecord.rows).toHaveLength(1);

        response = await page.goto(`${BASE}/admin/deals`);
        expect(response?.status()).toBe(200);
        main = page.locator("main");
        await expect(
          main.getByRole("heading", { level: 1, name: "Deals" }),
        ).toBeVisible();
        const approvedDeal = main
          .locator("article")
          .filter({ hasText: "Agreement value: ₦1,000" })
          .filter({ hasText: "@bob_test · provider" })
          .first();
        await expect(approvedDeal).toContainText(
          "Full-stack development service",
        );
        await expect(
          approvedDeal.getByText("approved", { exact: true }),
        ).toBeVisible();
        await expect(approvedDeal).toContainText("Simulated tracking");
        await expect(approvedDeal).toContainText(
          "2 participants · 0 milestones · 0 unresolved disputes",
        );
        await expect(approvedDeal).toContainText("@alice_test · client");
        await expect(approvedDeal).toContainText(
          `Deal reference: ${dealRecord.rows[0]!.id}`,
        );
        expect(await main.locator("article").count()).toBeLessThanOrEqual(20);
        await expect(main.locator('a[href^="/admin/deals/"]')).toHaveCount(0);
        await expect(
          main.locator(
            "article a, article form, article input, article select, article textarea, article button",
          ),
        ).toHaveCount(0);
        await expect(
          main.getByRole("heading", { name: /history|transitions?/i }),
        ).toHaveCount(0);
        const dealPayload = await page.content();
        for (const sensitive of [
          fixture.passwordHash,
          fixture.privateMessageBody,
          fixture.sessionHash,
          fixture.storageKey,
          dealRecord.rows[0]!.proposalDescription,
          dealRecord.rows[0]!.versionDescription,
        ]) {
          expect(dealPayload).not.toContain(sensitive);
        }
      } finally {
        await pool.end();
        if (!page.isClosed()) await page.close();
        await deleteAdminUsersBrowserFixture(fixture);
      }
    });

    test("ordinary users cannot access admin user or Deal summaries", async ({
      browser,
    }) => {
      const page = await browser.newPage();
      try {
        await createSession(page, "carol-test@perx.test");
        for (const path of ["/admin/users", "/admin/deals"]) {
          const response = await page.goto(`${BASE}${path}`);
          expect(response?.status()).toBe(404);
          await expect(
            page.getByRole("heading", { name: /Users|Deals/ }),
          ).toHaveCount(0);
        }
      } finally {
        await page.close();
      }
    });

    test("MASTER_ADMIN can load admin messages page without 500", async ({
      browser,
    }) => {
      const page = await browser.newPage();
      await createSession(page, "admin-test@perx.test");
      const response = await page.goto(`${BASE}/admin/messages`);
      expect(response?.status()).toBe(200);

      const bodyText = await page.innerText("body");
      expect(bodyText).not.toContain("500");
      expect(bodyText).not.toContain("Internal Server Error");
      expect(bodyText).not.toContain("PrismaClientInitializationError");
      expect(bodyText).not.toContain("Cannot read properties");
      await page.close();
    });

    test("MASTER_ADMIN can load admin reports page without 500", async ({
      browser,
    }) => {
      const page = await browser.newPage();
      await createSession(page, "admin-test@perx.test");
      const response = await page.goto(`${BASE}/admin/reports`);
      expect(response?.status()).toBe(200);

      const bodyText = await page.innerText("body");
      expect(bodyText).not.toContain("Internal Server Error");
      expect(bodyText).not.toContain("PrismaClientInitializationError");
      await page.close();
    });

    test("MASTER_ADMIN can load moderation case detail without 500", async ({
      browser,
    }) => {
      const { Pool } = await import("pg");
      const pool = new Pool({ connectionString: TEST_DB, ssl: false });
      let caseId: string;
      try {
        const res = await pool.query(
          `SELECT id FROM "ModerationCase" WHERE source = 'MESSAGE_REPORT' LIMIT 1`,
        );
        if (res.rows.length === 0) throw new Error("No moderation case found");
        caseId = res.rows[0].id;
      } finally {
        await pool.end();
      }

      const page = await browser.newPage();
      await createSession(page, "admin-test@perx.test");
      const response = await page.goto(
        `${BASE}/admin/moderation/cases/${caseId}`,
      );
      expect(response?.status()).toBe(200);

      const bodyText = await page.innerText("body");
      expect(bodyText).not.toContain("Internal Server Error");
      expect(bodyText).not.toContain("PrismaClientInitializationError");
      expect(bodyText).not.toContain("Cannot read properties");
      await page.close();
    });
  },
);
