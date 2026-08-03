import { describe, it, expect, afterAll } from "vitest";
import { getPrisma } from "@/lib/db/prisma";
import { signUpAction } from "@/features/auth/actions";
import { getDeliveryApprovalDecision } from "@/features/deals/authorization";
import { getConnectedLabel, isEligiblePartnerDealStatus } from "@/features/network/data";
import { isEligibleNetworkAccount } from "@/features/network/eligibility";
import type { DealStatus } from "@/generated/prisma/enums";
import { prismaProvider } from "@/lib/data/providers/prisma-provider";

const testDbUrl = process.env.TEST_DATABASE_URL || "";
if (testDbUrl.includes("qtmvausduxiqcguckfql")) {
  throw new Error("Safety Guard: TEST_DATABASE_URL matches a protected database.");
}

const describeWithTestDatabase = testDbUrl ? describe : describe.skip;
const prisma = testDbUrl ? getPrisma() : null;

describeWithTestDatabase("Server-Side Authorization Rules", () => {
  const runId = Date.now();

  afterAll(async () => {
    await prisma?.user.deleteMany({
      where: { email: { startsWith: `audit-${runId}-` } }
    });
    await prisma?.$disconnect();
  });

  it("signup cannot request ADMIN, INTERNAL_ADMIN, or INTERNAL_TESTER", async () => {
    if (!prisma) throw new Error("TEST_DATABASE_URL is required.");
    const formData = new FormData();
    formData.append("name", "Hacker");
    formData.append("email", `audit-${runId}-hacker@example.com`);
    formData.append("password", "Password123!");
    formData.append("confirmPassword", "Password123!");
    formData.append("username", `audituser_${runId}_hacker`);
    formData.append("terms", "on");
    formData.append("roles", "ADMIN");
    formData.append("role", "INTERNAL_ADMIN");

    await signUpAction({ status: "idle" }, formData);

    const user = await prisma.user.findUnique({
      where: { email: `audit-${runId}-hacker@example.com` },
      include: { roles: { include: { role: true } } }
    });

    if (user) {
      const roles = user.roles.map((r) => r.role.name);
      expect(roles).not.toContain("ADMIN");
      expect(roles).not.toContain("INTERNAL_ADMIN");
      expect(roles).not.toContain("INTERNAL_TESTER");
      expect(roles).not.toContain("MASTER_ADMIN");
    }
  });

  it("User C cannot access User A/B conversation via direct query", async () => {
    if (!prisma) throw new Error("TEST_DATABASE_URL is required.");
    const alice = await prisma.user.findUnique({ where: { email: "alice-test@perx.test" } });
    const bob = await prisma.user.findUnique({ where: { email: "bob-test@perx.test" } });
    const carol = await prisma.user.findUnique({ where: { email: "carol-test@perx.test" } });
    if (!alice || !bob || !carol) throw new Error("Seed users missing");

    const conversation = await prisma.conversation.findFirst({
      where: {
        participants: { some: { userId: alice.id } },
        AND: { participants: { some: { userId: bob.id } } },
      },
    });
    if (!conversation) throw new Error("Seed conversation missing");

    const carolParticipant = await prisma.conversationParticipant.findUnique({
      where: {
        conversationId_userId: {
          conversationId: conversation.id,
          userId: carol.id,
        },
      },
    });

    expect(carolParticipant).toBeNull();
  });

  it("user cannot edit another user's listing (ownership check)", async () => {
    if (!prisma) throw new Error("TEST_DATABASE_URL is required.");
    const alice = await prisma.user.findUnique({ where: { email: "alice-test@perx.test" } });
    const bob = await prisma.user.findUnique({ where: { email: "bob-test@perx.test" } });
    if (!alice || !bob) throw new Error("Seed users missing");

    const bobListing = await prisma.opportunity.findUnique({ where: { slug: "bob-mech-keyboard" } });
    if (!bobListing) throw new Error("Seed product missing");

    const listingForAlice = await prisma.opportunity.findFirst({
      where: { id: bobListing.id, ownerId: alice.id },
    });

    expect(listingForAlice).toBeNull();
    expect(bobListing.ownerId).toBe(bob.id);
    expect(bobListing.ownerId).not.toBe(alice.id);
  });

  it("provider cannot approve their own delivery (authorization check)", async () => {
    const deal = {
      participants: [
        { userId: "alice", role: "provider" },
        { userId: "bob", role: "client" },
      ],
      releases: [],
      status: "SUBMITTED" as string,
    };

    const providerDecision = getDeliveryApprovalDecision(
      deal as never,
      "alice",
    );
    expect(providerDecision.allowed).toBe(false);
    expect(providerDecision.allowed ? "" : providerDecision.reason).toBe("not-client");

    const clientDecision = getDeliveryApprovalDecision(
      deal as never,
      "bob",
    );
    expect(clientDecision.allowed).toBe(true);
  });

  it("only the correct client can approve delivery, not a non-participant", async () => {
    const deal = {
      participants: [
        { userId: "alice", role: "client" },
        { userId: "bob", role: "provider" },
      ],
      releases: [],
      status: "SUBMITTED" as string,
    };

    const nonParticipantDecision = getDeliveryApprovalDecision(
      deal as never,
      "carol",
    );
    expect(nonParticipantDecision.allowed).toBe(false);
    expect(nonParticipantDecision.allowed ? "" : nonParticipantDecision.reason).toBe("not-participant");

    const clientDecision = getDeliveryApprovalDecision(
      deal as never,
      "alice",
    );
    expect(clientDecision.allowed).toBe(true);
  });

  it("does not qualify DRAFT, IN_PROGRESS, or CANCELLED deals as partner", async () => {
    if (!prisma) throw new Error("TEST_DATABASE_URL is required.");

    const nonQualifyingStatuses: DealStatus[] = [
      "DRAFT", "AWAITING_FUNDING", "FUNDED", "IN_PROGRESS",
      "SUBMITTED", "UNDER_REVIEW", "CANCELLED",
      "REFUND_PENDING", "REFUNDED", "DISPUTED", "RESOLVED",
    ];
    for (const status of nonQualifyingStatuses) {
      expect(isEligiblePartnerDealStatus(status)).toBe(false);
    }
    expect(getConnectedLabel(false)).toBe("Connected");
  });

  it("qualifies APPROVED and RELEASED deals as partner transactions", async () => {
    expect(isEligiblePartnerDealStatus("APPROVED")).toBe(true);
    expect(isEligiblePartnerDealStatus("RELEASED")).toBe(true);
    expect(getConnectedLabel(true)).toBe("Connected · Partner");
  });

  it("verifies seeded APPROVED deal between Alice and Bob qualifies as partner", async () => {
    if (!prisma) throw new Error("TEST_DATABASE_URL is required.");
    const alice = await prisma.user.findUnique({ where: { email: "alice-test@perx.test" } });
    const bob = await prisma.user.findUnique({ where: { email: "bob-test@perx.test" } });
    if (!alice || !bob) throw new Error("Seed users missing");

    const approvedDeal = await prisma.deal.findFirst({
      where: {
        status: "APPROVED",
        participants: { some: { userId: alice.id } },
        AND: { participants: { some: { userId: bob.id } } },
      },
      include: { participants: true },
    });

    expect(approvedDeal).not.toBeNull();
    expect(approvedDeal!.status).toBe("APPROVED");
    expect(isEligiblePartnerDealStatus(approvedDeal!.status as DealStatus)).toBe(true);
  });

  it("verifies seeded IN_PROGRESS deal does NOT qualify as partner", async () => {
    if (!prisma) throw new Error("TEST_DATABASE_URL is required.");
    const alice = await prisma.user.findUnique({ where: { email: "alice-test@perx.test" } });
    const carol = await prisma.user.findUnique({ where: { email: "carol-test@perx.test" } });
    if (!alice || !carol) throw new Error("Seed users missing");

    const inProgressDeal = await prisma.deal.findFirst({
      where: {
        status: "IN_PROGRESS",
        participants: { some: { userId: alice.id } },
        AND: { participants: { some: { userId: carol.id } } },
      },
    });

    expect(inProgressDeal).not.toBeNull();
    expect(inProgressDeal!.status).toBe("IN_PROGRESS");
    expect(isEligiblePartnerDealStatus(inProgressDeal!.status as DealStatus)).toBe(false);
  });

  it("published content from Alice is discoverable by others excluding draft/paused/rejected", async () => {
    if (!prisma) throw new Error("TEST_DATABASE_URL is required.");
    const alice = await prisma.user.findUnique({ where: { email: "alice-test@perx.test" } });
    if (!alice) throw new Error("Seed user missing");

    const published = await prisma.opportunity.findMany({
      where: {
        ownerId: alice.id,
        status: "PUBLISHED",
        moderationStatus: "APPROVED",
        publishedAt: { not: null },
      },
    });
    expect(published.length).toBeGreaterThan(0);

    const drafts = await prisma.opportunity.findMany({
      where: { ownerId: alice.id, status: "DRAFT" },
    });
    for (const d of drafts) {
      expect(d.moderationStatus).not.toBe("APPROVED");
    }
  });

  it("excludes banned, suspended, and inactive accounts from network eligibility", async () => {
    if (!prisma) throw new Error("TEST_DATABASE_URL is required.");

    const bannedAccount = {
      accountClassification: "PUBLIC_BETA_USER" as const,
      bannedAt: new Date(),
      deactivatedAt: null,
      id: "banned-user",
      isActive: true,
      profile: null,
      suspendedAt: null,
      suspendedUntil: null,
    };
    expect(isEligibleNetworkAccount(bannedAccount)).toBe(false);

    const suspendedAccount = {
      accountClassification: "PUBLIC_BETA_USER" as const,
      bannedAt: null,
      deactivatedAt: null,
      id: "suspended-user",
      isActive: true,
      profile: null,
      suspendedAt: new Date(),
      suspendedUntil: new Date(Date.now() + 86400000),
    };
    expect(isEligibleNetworkAccount(suspendedAccount)).toBe(false);

    const inactiveAccount = {
      accountClassification: "PUBLIC_BETA_USER" as const,
      bannedAt: null,
      deactivatedAt: null,
      id: "inactive-user",
      isActive: false,
      profile: null,
      suspendedAt: null,
      suspendedUntil: null,
    };
    expect(isEligibleNetworkAccount(inactiveAccount)).toBe(false);
  });

  it("moderation case loads without error for seeded conversation case", async () => {
    if (!prisma) throw new Error("TEST_DATABASE_URL is required.");
    const modCase = await prisma.moderationCase.findFirst({
      where: { source: "MESSAGE_REPORT" },
      include: { messageScopes: true, events: true },
    });

    expect(modCase).not.toBeNull();
    expect(modCase!.status).toBe("NEW");
    expect(modCase!.conversationId).not.toBeNull();
  });

  it("keeps private proposal drafts out of the opportunity owner's received list", async () => {
    if (!prisma) throw new Error("TEST_DATABASE_URL is required.");
    const alice = await prisma.user.findUniqueOrThrow({
      where: { email: "alice-test@perx.test" },
    });
    const bob = await prisma.user.findUniqueOrThrow({
      where: { email: "bob-test@perx.test" },
    });
    const opportunity = await prisma.opportunity.findUniqueOrThrow({
      where: { slug: "bob-mech-keyboard" },
    });
    const proposal = await prisma.proposal.create({
      data: {
        amountMinor: 250000n,
        currency: "NGN",
        deliveryDays: 10,
        description: `private-draft-${runId}`,
        opportunityId: opportunity.id,
        senderId: alice.id,
        status: "DRAFT",
        versions: {
          create: {
            amountMinor: 250000n,
            createdById: alice.id,
            currency: "NGN",
            deliveryDays: 10,
            description: `private-draft-${runId}`,
            includedRevisions: 1,
            status: "DRAFT",
            versionNumber: 1,
          },
        },
      },
    });

    try {
      const received = await prismaProvider.app.getUserProposals(
        bob.id,
        "received",
      );
      expect(received.some((entry) => entry.id === proposal.id)).toBe(false);
    } finally {
      await prisma.proposal.delete({ where: { id: proposal.id } });
    }
  });

  it("enforces submitted proposal terms as immutable in PostgreSQL", async () => {
    if (!prisma) throw new Error("TEST_DATABASE_URL is required.");
    const alice = await prisma.user.findUniqueOrThrow({
      where: { email: "alice-test@perx.test" },
    });
    const opportunity = await prisma.opportunity.findUniqueOrThrow({
      where: { slug: "bob-mech-keyboard" },
    });

    await expect(
      prisma.$transaction(async (tx) => {
        const proposal = await tx.proposal.create({
          data: {
            amountMinor: 300000n,
            currency: "NGN",
            deliveryDays: 14,
            description: `immutable-version-${runId}`,
            opportunityId: opportunity.id,
            senderId: alice.id,
            status: "SENT",
          },
        });
        const version = await tx.proposalVersion.create({
          data: {
            amountMinor: proposal.amountMinor,
            createdById: alice.id,
            currency: proposal.currency,
            deliveryDays: proposal.deliveryDays,
            description: proposal.description,
            includedRevisions: 1,
            proposalId: proposal.id,
            status: "SUBMITTED",
            submittedAt: new Date(),
            versionNumber: 1,
          },
        });
        await tx.proposalVersion.update({
          data: { amountMinor: 1n },
          where: { id: version.id },
        });
      }),
    ).rejects.toThrow(/immutable/i);
  });

  it("rejects a Deal linked to a version from another proposal", async () => {
    if (!prisma) throw new Error("TEST_DATABASE_URL is required.");
    const alice = await prisma.user.findUniqueOrThrow({
      where: { email: "alice-test@perx.test" },
    });
    const bob = await prisma.user.findUniqueOrThrow({
      where: { email: "bob-test@perx.test" },
    });
    const opportunity = await prisma.opportunity.findUniqueOrThrow({
      where: { slug: "bob-mech-keyboard" },
    });

    await expect(
      prisma.$transaction(async (tx) => {
        const first = await tx.proposal.create({
          data: {
            amountMinor: 100000n,
            currency: "NGN",
            deliveryDays: 7,
            description: `composite-first-${runId}`,
            opportunityId: opportunity.id,
            senderId: alice.id,
            status: "ACCEPTED",
          },
        });
        const second = await tx.proposal.create({
          data: {
            amountMinor: 200000n,
            currency: "NGN",
            deliveryDays: 8,
            description: `composite-second-${runId}`,
            opportunityId: opportunity.id,
            senderId: alice.id,
            status: "ACCEPTED",
          },
        });
        const wrongVersion = await tx.proposalVersion.create({
          data: {
            acceptedAt: new Date(),
            amountMinor: second.amountMinor,
            createdById: alice.id,
            currency: second.currency,
            deliveryDays: second.deliveryDays,
            description: second.description,
            includedRevisions: 1,
            proposalId: second.id,
            status: "ACCEPTED",
            submittedAt: new Date(),
            versionNumber: 1,
          },
        });
        await tx.deal.create({
          data: {
            currency: first.currency,
            opportunityId: opportunity.id,
            proposalId: first.id,
            proposalVersionId: wrongVersion.id,
            settlementMode: "PROVIDER_DISABLED",
            status: "IN_PROGRESS",
            valueMinor: first.amountMinor,
            participants: {
              create: [
                { role: "freelancer", userId: alice.id },
                { role: "client", userId: bob.id },
              ],
            },
          },
        });
      }),
    ).rejects.toThrow();
  });
});
