import "../utils/legacy-auth";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import * as databaseModule from "@/lib/db/prisma";
import { signUpAction } from "@/features/auth/actions";
import { getPublicFeedResult } from "@/lib/data/public-feed";
import { setOpportunityBookmarkAction } from "@/features/opportunities/actions";
import { updateOpportunityAction } from "@/features/opportunities/actions";
import { getDeliveryApprovalDecision } from "@/features/deals/authorization";
import {
  getConnectedLabel,
  getConnectionsTabData,
  isEligiblePartnerDealStatus,
} from "@/features/network/data";
import {
  isEligibleNetworkAccount,
  networkAccountEligibilitySelect,
} from "@/features/network/eligibility";
import type { DealStatus } from "@/generated/prisma/enums";
import {
  createSession,
  getCurrentUser,
  requireCapability,
} from "@/lib/auth/session";
import { setCachedDataModeForTest } from "@/lib/env";
import { prismaProvider } from "@/lib/data/providers/prisma-provider";
import { getIsolatedTestDatabaseUrl } from "../e2e/utils/db-guard";
import {
  authorizationFixtures,
  createAuthorizationDatabase,
  withAuthorizationTransaction,
  type AuthorizationFixtures,
} from "../utils/authorization-fixtures";

// Supply only the Next request/cache boundary. Session lookup, capabilities,
// redirects, actions, provider queries and PostgreSQL constraints are real.
const requestCookies = vi.hoisted(() => new Map<string, string>());
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      requestCookies.has(name)
        ? { value: requestCookies.get(name) }
        : undefined,
    has: (name: string) => requestCookies.has(name),
    set: (name: string, value: string) => requestCookies.set(name, value),
  }),
  headers: async () =>
    new Headers({ "user-agent": "PtahX authorization integration" }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const testDbUrl = getIsolatedTestDatabaseUrl();
// Existing contract: absent TEST_DATABASE_URL skips; invalid/unreachable DB fails.
const describeWithTestDatabase = testDbUrl ? describe : describe.skip;

function expectRedirect(result: Promise<unknown>, location: string) {
  return expect(result).rejects.toMatchObject({
    digest: `NEXT_REDIRECT;replace;${location};307;`,
  });
}

function editForm() {
  const form = new FormData();
  for (const [key, value] of Object.entries({
    title: "Updated software delivery service",
    summary: "A professional software delivery service.",
    description:
      "Professional software delivery including implementation, automated testing and complete project documentation.",
    type: "SERVICE",
    category: "software",
    currency: "NGN",
    intent: "draft",
    budgetMin: "",
    budgetMax: "",
    location: "Lagos",
    skills: "",
  }))
    form.set(key, value);
  return form;
}

describeWithTestDatabase("Server-Side Authorization Rules", () => {
  let database: ReturnType<typeof createAuthorizationDatabase>;

  beforeAll(async () => {
    database = createAuthorizationDatabase();
    await database.$queryRaw`SELECT 1`; // Open the isolated connection before transaction acquire timing starts.
    vi.stubEnv("DATABASE_URL", testDbUrl!);
    vi.stubEnv("DIRECT_URL", process.env.TEST_DIRECT_URL || testDbUrl!);
    vi.stubEnv("PERX_DATA_MODE", "database");
    // Exercise successful registration independently of a developer's beta cap.
    vi.stubEnv("PERX_SIGNUP_MODE", "public");
    setCachedDataModeForTest("database");
  }, 30_000);
  afterAll(async () => {
    await database?.$disconnect();
    setCachedDataModeForTest(undefined);
    vi.unstubAllEnvs();
  });

  it("rolls back fixture writes and propagates test failures", async () => {
    const failure = new Error("Deliberate fixture failure");
    let userId = "";
    await expect(
      withAuthorizationTransaction(database, async (prisma) => {
        const fixture = authorizationFixtures(prisma);
        userId = (await fixture.user()).id;
        throw failure;
      }),
    ).rejects.toBe(failure);
    expect(userId).not.toBe("");
    expect(
      await database.user.findUnique({ where: { id: userId } }),
    ).toBeNull();
  });

  function dbTest(
    name: string,
    run: (fixture: AuthorizationFixtures) => Promise<void>,
  ) {
    it(
      name,
      async () => {
        requestCookies.clear();
        const ownedUserIds: string[] = [];
        await withAuthorizationTransaction(database, async (prisma) => {
          const fixture = authorizationFixtures(prisma);
          const getPrisma = vi
            .spyOn(databaseModule, "getPrisma")
            .mockReturnValue(prisma);
          try {
            await run(fixture);
          } finally {
            ownedUserIds.push(...fixture.userIds);
            getPrisma.mockRestore();
            requestCookies.clear();
          }
        });
        expect(
          await database.user.count({ where: { id: { in: ownedUserIds } } }),
        ).toBe(0);
      },
      20_000,
    );
  }

  dbTest(
    "anonymous landing feed uses public visibility without private viewer state",
    async (f) => {
      const owner = await f.user(["CLIENT"]);
      const eligible = await f.opportunity(owner.id, {
        publishedAt: new Date("2050-01-01"),
      });
      const hidden = [];
      for (const overrides of [
        { status: "DRAFT" as const },
        { status: "PAUSED" as const },
        { status: "ARCHIVED" as const },
        { moderationStatus: "REJECTED" as const },
        { publishedAt: null },
        { type: "INVESTMENT" as const },
      ])
        hidden.push(
          await f.opportunity(owner.id, {
            publishedAt: new Date("2051-01-01"),
            ...overrides,
          }),
        );
      const privateOwner = await f.user();
      await f.prisma.profile.update({
        where: { userId: privateOwner.id },
        data: { isDiscoverable: false },
      });
      hidden.push(
        await f.opportunity(privateOwner.id, {
          publishedAt: new Date("2051-01-01"),
        }),
      );
      const bookmarks = vi.spyOn(f.prisma.opportunityBookmark, "findMany");
      const connections = vi.spyOn(f.prisma.connection, "findMany");
      try {
        const result = await getPublicFeedResult();
        expect(result.unavailable).toBe(false);
        expect(result.posts.map((p) => p.id)).toContain(eligible.id);
        for (const row of hidden)
          expect(result.posts.map((p) => p.id)).not.toContain(row.id);
        for (const post of result.posts) {
          expect(post).not.toHaveProperty("viewerHasSaved");
          expect(post).not.toHaveProperty("description");
          expect(post).not.toHaveProperty("owner");
        }
        expect(bookmarks).not.toHaveBeenCalled();
        expect(connections).not.toHaveBeenCalled();
        for (let i = 0; i < 13; i++)
          await f.opportunity(owner.id, {
            publishedAt: new Date("2050-02-01"),
          });
        expect((await getPublicFeedResult()).posts).toHaveLength(12);
      } finally {
        bookmarks.mockRestore();
        connections.mockRestore();
      }
    },
  );

  dbTest(
    "anonymous feed save action refuses before any bookmark write",
    async (f) => {
      const owner = await f.user(["CLIENT"]);
      const post = await f.opportunity(owner.id);
      await expectRedirect(
        setOpportunityBookmarkAction(post.id, true),
        "/sign-in?next=/app",
      );
      expect(
        await f.prisma.opportunityBookmark.count({
          where: { opportunityId: post.id },
        }),
      ).toBe(0);
    },
  );

  dbTest(
    "nested action transactions roll back partial writes on failure",
    async (f) => {
      const failure = new Error("Deliberate action failure");
      const owner = await f.user(["CLIENT"]);
      const listing = await f.opportunity(owner.id);
      await expect(
        f.prisma.$transaction(async (tx) => {
          await tx.opportunity.update({
            where: { id: listing.id },
            data: { title: "Must roll back" },
          });
          throw failure;
        }),
      ).rejects.toBe(failure);
      expect(
        await f.prisma.opportunity.findUniqueOrThrow({
          where: { id: listing.id },
        }),
      ).toMatchObject({ title: listing.title });
    },
  );

  dbTest(
    "signup cannot request ADMIN, INTERNAL_ADMIN, INTERNAL_TESTER, or MASTER_ADMIN",
    async (f) => {
      const form = new FormData();
      const email = `authz-signup-${f.namespace}@ptahx.test`;
      for (const [key, value] of Object.entries({
        name: "Signup fixture",
        email,
        password: "Password123!",
        confirmPassword: "Password123!",
        username: `signup_${f.namespace.replaceAll("-", "").slice(0, 22)}`,
        terms: "on",
        role: "INTERNAL_ADMIN",
      }))
        form.set(key, value);
      for (const role of [
        "ADMIN",
        "INTERNAL_ADMIN",
        "INTERNAL_TESTER",
        "MASTER_ADMIN",
      ])
        form.append("roles", role);

      await expectRedirect(
        signUpAction({ status: "idle" }, form),
        "/app/profile/setup",
      );
      const user = await f.prisma.user.findUniqueOrThrow({
        where: { email },
        include: { roles: { include: { role: true } }, sessions: true },
      });
      f.userIds.push(user.id);
      expect(user.roles.map(({ role }) => role.name)).toEqual(["MEMBER"]);
      expect(user.sessions).toHaveLength(1);
      expect(await getCurrentUser()).toMatchObject({
        id: user.id,
        roles: ["MEMBER"],
      });
      expect(
        await f.prisma.auditLog.count({
          where: { actorId: user.id, action: "auth.sign_up" },
        }),
      ).toBe(1);
    },
  );

  dbTest(
    "User C cannot access User A/B conversation through production providers",
    async (f) => {
      const alice = await f.user(["FREELANCER"]);
      const bob = await f.user(["CLIENT"]);
      const carol = await f.user(["FREELANCER"]);
      const conversation = await f.conversation([alice.id, bob.id]);
      expect(
        await f.prisma.conversationParticipant.count({
          where: { conversationId: conversation.id, userId: carol.id },
        }),
      ).toBe(0);
      expect(
        await prismaProvider.app.getConversationForUser(
          conversation.id,
          carol.id,
        ),
      ).toBeNull();
      expect(
        await prismaProvider.app.getConversationMessages(
          conversation.id,
          carol.id,
        ),
      ).toEqual([]);
      expect(await prismaProvider.app.getConversations(carol.id)).toEqual([]);
      expect(
        await prismaProvider.app.getConversationForUser(
          conversation.id,
          alice.id,
        ),
      ).toMatchObject({ id: conversation.id });
      expect(
        await prismaProvider.app.getConversationMessages(
          conversation.id,
          bob.id,
        ),
      ).toMatchObject([{ id: conversation.messages[0].id }]);
    },
  );

  dbTest(
    "user cannot edit another user's listing (ownership check)",
    async (f) => {
      const alice = await f.user(["CLIENT"]);
      const bob = await f.user(["CLIENT"]);
      const listing = await f.opportunity(bob.id, {
        status: "DRAFT",
        moderationStatus: "PENDING",
        publishedAt: null,
      });
      await createSession(alice.id);
      await expectRedirect(
        updateOpportunityAction(listing.id, editForm()),
        "/app/manage?error=not-found",
      );
      expect(
        await f.prisma.opportunity.findUniqueOrThrow({
          where: { id: listing.id },
        }),
      ).toMatchObject({ ownerId: bob.id, title: listing.title });
      expect(
        await f.prisma.auditLog.count({ where: { entityId: listing.id } }),
      ).toBe(0);
    },
  );

  dbTest(
    "CLIENT owner can edit a listing using database session roles",
    async (f) => {
      const owner = await f.user(["CLIENT"]);
      const listing = await f.opportunity(owner.id, {
        status: "DRAFT",
        moderationStatus: "PENDING",
        publishedAt: null,
      });
      await createSession(owner.id);
      await expectRedirect(
        updateOpportunityAction(listing.id, editForm()),
        "/app/manage?updated=1",
      );
      expect(
        await f.prisma.opportunity.findUniqueOrThrow({
          where: { id: listing.id },
        }),
      ).toMatchObject({ title: editForm().get("title"), ownerId: owner.id });
      expect(
        await f.prisma.auditLog.findFirst({
          where: { entityId: listing.id, action: "opportunity.update" },
        }),
      ).toMatchObject({ actorId: owner.id });
    },
  );

  dbTest(
    "MEMBER ownership alone does not grant editing capability",
    async (f) => {
      const owner = await f.user();
      const listing = await f.opportunity(owner.id, { status: "DRAFT" });
      await createSession(owner.id);
      await expectRedirect(
        updateOpportunityAction(listing.id, editForm()),
        "/app?error=forbidden",
      );
      expect(
        await f.prisma.opportunity.findUniqueOrThrow({
          where: { id: listing.id },
        }),
      ).toMatchObject({ title: listing.title });
    },
  );

  dbTest(
    "listing edits require a persisted authenticated session",
    async (f) => {
      const owner = await f.user(["CLIENT"]);
      const listing = await f.opportunity(owner.id);
      await expectRedirect(
        updateOpportunityAction(listing.id, editForm()),
        "/sign-in?next=/app",
      );
      expect(
        await f.prisma.opportunity.findUniqueOrThrow({
          where: { id: listing.id },
        }),
      ).toMatchObject({ title: listing.title });
    },
  );

  dbTest(
    "admin access uses current persisted roles, including revocation",
    async (f) => {
      const member = await f.user();
      const admin = await f.user(["ADMIN"]);
      await createSession(member.id);
      await expectRedirect(
        requireCapability("admin:access"),
        "/app?error=forbidden",
      );
      await createSession(admin.id);
      expect(await requireCapability("admin:access")).toMatchObject({
        id: admin.id,
      });
      await f.prisma.userRole.deleteMany({ where: { userId: admin.id } });
      await expectRedirect(
        requireCapability("admin:access"),
        "/app?error=forbidden",
      );
    },
  );

  dbTest(
    "provider cannot approve their own delivery (authorization check)",
    async (f) => {
      const client = await f.user(["CLIENT"]);
      const provider = await f.user(["FREELANCER"]);
      const deal = await f.deal(client.id, provider.id, "SUBMITTED");
      expect(getDeliveryApprovalDecision(deal, provider.id)).toEqual({
        allowed: false,
        reason: "not-client",
      });
      expect(getDeliveryApprovalDecision(deal, client.id)).toEqual({
        allowed: true,
      });
    },
  );

  dbTest(
    "only the correct client can approve delivery, not a non-participant",
    async (f) => {
      const client = await f.user(["CLIENT"]);
      const provider = await f.user(["FREELANCER"]);
      const outsider = await f.user(["CLIENT"]);
      const deal = await f.deal(client.id, provider.id, "SUBMITTED");
      expect(
        await prismaProvider.app.getDealForUser(deal.id, outsider.id),
      ).toBeNull();
      const visible = await prismaProvider.app.getDealForUser(
        deal.id,
        client.id,
      );
      expect(visible).toMatchObject({ id: deal.id });
      expect(getDeliveryApprovalDecision(deal, outsider.id)).toEqual({
        allowed: false,
        reason: "not-participant",
      });
      expect(getDeliveryApprovalDecision(deal, client.id)).toEqual({
        allowed: true,
      });
    },
  );

  dbTest(
    "does not qualify DRAFT, IN_PROGRESS, or CANCELLED deals as partner",
    async () => {
      const statuses: DealStatus[] = [
        "DRAFT",
        "AWAITING_FUNDING",
        "FUNDED",
        "IN_PROGRESS",
        "SUBMITTED",
        "UNDER_REVIEW",
        "CANCELLED",
        "REFUND_PENDING",
        "REFUNDED",
        "DISPUTED",
        "RESOLVED",
      ];
      for (const status of statuses)
        expect(isEligiblePartnerDealStatus(status)).toBe(false);
      expect(getConnectedLabel(false)).toBe("Connected");
    },
  );

  dbTest(
    "qualifies APPROVED and RELEASED deals as partner transactions",
    async () => {
      expect(isEligiblePartnerDealStatus("APPROVED")).toBe(true);
      expect(isEligiblePartnerDealStatus("RELEASED")).toBe(true);
      expect(getConnectedLabel(true)).toBe("Connected · Partner");
    },
  );

  dbTest(
    "APPROVED deal between connected members qualifies as partner",
    async (f) => {
      const client = await f.user(["CLIENT"]);
      const provider = await f.user(["FREELANCER"]);
      await f.deal(client.id, provider.id, "APPROVED");
      await f.prisma.connection.create({
        data: {
          requesterId: client.id,
          receiverId: provider.id,
          status: "ACCEPTED",
        },
      });
      expect(
        await getConnectionsTabData(client.id, "connections"),
      ).toMatchObject([{ id: provider.id, isPartner: true }]);
    },
  );

  dbTest(
    "IN_PROGRESS deal does NOT qualify connected members as partners",
    async (f) => {
      const client = await f.user(["CLIENT"]);
      const provider = await f.user(["FREELANCER"]);
      await f.deal(client.id, provider.id, "IN_PROGRESS");
      await f.prisma.connection.create({
        data: {
          requesterId: client.id,
          receiverId: provider.id,
          status: "ACCEPTED",
        },
      });
      expect(
        await getConnectionsTabData(client.id, "connections"),
      ).toMatchObject([{ id: provider.id, isPartner: false }]);
    },
  );

  dbTest(
    "published content is discoverable by others excluding draft/paused/rejected",
    async (f) => {
      const owner = await f.user(["CLIENT"]);
      const published = await f.opportunity(owner.id);
      const drafts = [
        await f.opportunity(owner.id, {
          status: "DRAFT",
          moderationStatus: "PENDING",
          publishedAt: null,
        }),
        await f.opportunity(owner.id, { status: "PAUSED" }),
        await f.opportunity(owner.id, { moderationStatus: "REJECTED" }),
      ];
      const feed = await prismaProvider.opportunities.getOpportunityFeed({
        q: f.namespace,
      });
      expect(feed.map((entry) => entry.id)).toEqual([published.id]);
      expect(
        await prismaProvider.opportunities.getOpportunityBySlug(published.slug),
      ).toMatchObject({ id: published.id });
      for (const hidden of drafts)
        expect(
          await prismaProvider.opportunities.getOpportunityBySlug(hidden.slug),
        ).toBeNull();
    },
  );

  dbTest(
    "excludes banned, suspended, and inactive accounts from network eligibility",
    async (f) => {
      const user = await f.user();
      const select = networkAccountEligibilitySelect;
      expect(
        isEligibleNetworkAccount(
          await f.prisma.user.findUnique({ where: { id: user.id }, select }),
        ),
      ).toBe(true);
      for (const state of [
        {
          bannedAt: new Date(),
          suspendedAt: null,
          suspendedUntil: null,
          isActive: true,
        },
        {
          bannedAt: null,
          suspendedAt: new Date(),
          suspendedUntil: new Date(Date.now() + 86400000),
          isActive: true,
        },
        {
          bannedAt: null,
          suspendedAt: null,
          suspendedUntil: null,
          isActive: false,
        },
      ]) {
        const account = await f.prisma.user.update({
          where: { id: user.id },
          data: state,
          select,
        });
        expect(isEligibleNetworkAccount(account)).toBe(false);
      }
    },
  );

  dbTest(
    "moderation case loads with its own conversation, scope, and event",
    async (f) => {
      const reporter = await f.user();
      const reported = await f.user();
      const reviewer = await f.user(["ADMIN"]);
      const conversation = await f.conversation([reporter.id, reported.id]);
      const messageId = conversation.messages[0].id;
      const created = await f.prisma.moderationCase.create({
        data: {
          source: "MESSAGE_REPORT",
          status: "NEW",
          category: "HARASSMENT",
          title: "Fixture message report",
          summary: "Review requested for fixture message",
          targetType: "MESSAGE",
          targetId: messageId,
          reporterId: reporter.id,
          reportedUserId: reported.id,
          conversationId: conversation.id,
          messageId,
          events: {
            create: {
              actorId: reporter.id,
              type: "case.opened",
              nextStatus: "NEW",
            },
          },
          messageScopes: {
            create: {
              conversationId: conversation.id,
              messageId,
              revealedById: reviewer.id,
              reason: "Report review",
              scope: "MESSAGE",
            },
          },
        },
      });
      const loaded = await f.prisma.moderationCase.findUniqueOrThrow({
        where: { id: created.id },
        include: { messageScopes: true, events: true },
      });
      expect(loaded).toMatchObject({
        status: "NEW",
        conversationId: conversation.id,
      });
      expect(loaded.messageScopes).toHaveLength(1);
      expect(loaded.events).toHaveLength(1);
    },
  );

  dbTest(
    "keeps private proposal drafts out of the opportunity owner's received list",
    async (f) => {
      const sender = await f.user(["FREELANCER"]);
      const owner = await f.user(["CLIENT"]);
      const listing = await f.opportunity(owner.id);
      const draft = await f.proposal(sender.id, listing.id, "DRAFT");
      const sent = await f.proposal(sender.id, listing.id, "SENT");
      const received = await prismaProvider.app.getUserProposals(
        owner.id,
        "received",
      );
      expect(received.map((entry) => entry.id)).toEqual([sent.id]);
      expect(received.some((entry) => entry.id === draft.id)).toBe(false);
      expect(
        (await prismaProvider.app.getUserProposals(sender.id, "sent")).map(
          (entry) => entry.id,
        ),
      ).toEqual(expect.arrayContaining([draft.id, sent.id]));
    },
  );

  dbTest(
    "enforces submitted proposal terms as immutable in PostgreSQL",
    async (f) => {
      const sender = await f.user(["FREELANCER"]);
      const owner = await f.user(["CLIENT"]);
      const listing = await f.opportunity(owner.id);
      const draft = await f.proposal(sender.id, listing.id, "DRAFT");
      const submitted = await f.proposal(sender.id, listing.id, "SENT");
      await f.prisma.proposalVersion.update({
        where: { id: draft.versions[0].id },
        data: { amountMinor: 1n },
      });
      await expect(
        f.prisma.$transaction(async (tx) => {
          await tx.proposalVersion.update({
            where: { id: submitted.versions[0].id },
            data: { amountMinor: 1n },
          });
        }),
      ).rejects.toThrow(/immutable/i);
      expect(
        await f.prisma.proposalVersion.findUniqueOrThrow({
          where: { id: submitted.versions[0].id },
        }),
      ).toMatchObject({ amountMinor: 100000n });
    },
  );

  dbTest(
    "rejects a Deal linked to a version from another proposal",
    async (f) => {
      const sender = await f.user(["FREELANCER"]);
      const owner = await f.user(["CLIENT"]);
      const listing = await f.opportunity(owner.id);
      const first = await f.proposal(sender.id, listing.id, "ACCEPTED");
      const second = await f.proposal(sender.id, listing.id, "ACCEPTED");
      const data = {
        opportunityId: listing.id,
        proposalId: first.id,
        proposalVersionId: second.versions[0].id,
        valueMinor: first.amountMinor,
      };
      await expect(
        f.prisma.$transaction(async (tx) => tx.deal.create({ data })),
      ).rejects.toMatchObject({ code: "P2003" });
      expect(
        await f.prisma.deal.create({
          data: { ...data, proposalVersionId: first.versions[0].id },
        }),
      ).toMatchObject({ proposalId: first.id });
    },
  );

  dbTest(
    "loads conversations with the current messaging schema and legacy JSON snapshots",
    async (f) => {
      const alice = await f.user(["FREELANCER"]);
      const bob = await f.user(["CLIENT"]);
      const conversation = await f.conversation([alice.id, bob.id]);
      const eventId = `schema_regression_${f.namespace}`;
      await f.prisma.$executeRaw`
      INSERT INTO "ConversationEvent" ("id", "conversationId", "actorId", "type", "snapshot", "idempotencyKey", "createdAt")
      VALUES (${eventId}, ${conversation.id}, ${alice.id}, 'DEAL_STATUS_CHANGED'::"ConversationEventType", 'null'::jsonb, ${eventId}, NOW())
    `;
      const loaded = (await prismaProvider.app.getConversations(alice.id)).find(
        (entry) => entry.id === conversation.id,
      );
      expect(loaded).toBeDefined();
      expect(
        loaded?.participants.some(
          (entry: { userId: string }) => entry.userId === alice.id,
        ),
      ).toBe(true);
      expect(
        loaded?.events.some((entry: { id: string }) => entry.id === eventId),
      ).toBe(true);
    },
  );

  dbTest(
    "filters a participant-locally removed conversation without a render-time query failure",
    async (f) => {
      const alice = await f.user(["FREELANCER"]);
      const bob = await f.user(["CLIENT"]);
      const conversation = await f.conversation([alice.id, bob.id]);
      expect(await prismaProvider.app.getConversations(alice.id)).toMatchObject(
        [{ id: conversation.id }],
      );
      expect(
        await prismaProvider.app.getConversationMessages(
          conversation.id,
          alice.id,
        ),
      ).toHaveLength(1);
      await f.prisma.conversationParticipant.update({
        where: {
          conversationId_userId: {
            conversationId: conversation.id,
            userId: alice.id,
          },
        },
        data: { removedAt: new Date() },
      });
      expect(await prismaProvider.app.getConversations(alice.id)).toEqual([]);
      expect(
        await prismaProvider.app.getConversationMessages(
          conversation.id,
          alice.id,
        ),
      ).toEqual([]);
      expect(
        await prismaProvider.app.getConversationMessages(
          conversation.id,
          bob.id,
        ),
      ).toHaveLength(1);
    },
  );

  dbTest(
    "returns minimized administrator user rows without authentication secrets",
    async (f) => {
      const user = await f.user();
      const rows = await prismaProvider.admin.getAdminList("users");
      expect(rows.some((row) => row.id === user.id)).toBe(true);
      for (const row of rows) {
        for (const field of [
          "passwordHash",
          "imageStorageKey",
          "sessions",
          "enforcementReasonPublic",
          "activeEnforcements",
        ])
          expect(row).not.toHaveProperty(field);
        for (const field of [
          "id",
          "accountState",
          "activeRestrictions",
          "activity",
          "roles",
        ])
          expect(row).toHaveProperty(field);
      }
    },
  );
});
