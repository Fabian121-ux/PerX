import "dotenv/config";
import bcrypt from "bcryptjs";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const connectionString = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
if (!connectionString) throw new Error("TEST_DATABASE_URL or DATABASE_URL required.");
if (connectionString.includes("qtmvausduxiqcguckfql")) {
  throw new Error("Safety Guard: refusing to seed Production database.");
}
if (!connectionString.includes("127.0.0.1") && !connectionString.includes("localhost")) {
  throw new Error("Safety Guard: refusing to seed non-local database.");
}

const pool = new Pool({ connectionString, ssl: false });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const PASSWORD = "TestPassword123!";

async function upsertUser(
  email: string,
  username: string,
  name: string,
  classification: "PUBLIC_BETA_USER" | "INTERNAL_ADMIN" | "INTERNAL_TEST_USER",
  roles: string[],
) {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        accountClassification: classification,
        name,
        passwordHash,
        username,
        verificationStatus: roles.includes("MASTER_ADMIN") ? "VERIFIED" : "UNVERIFIED",
        profile: {
          create: {
            biography: `${name} test biography`,
            headline: `${name} headline`,
            location: "Test City",
            profileCompleteness: 80,
            isDiscoverable: true,
            allowConnectionRequests: true,
            allowMessagesFromConnections: true,
          },
        },
      },
    });
  }
  const roleRecords = await prisma.role.findMany({ where: { name: { in: roles as never[] } } });
  await prisma.userRole.createMany({
    data: roleRecords.map((r) => ({ roleId: r.id, userId: user.id })),
    skipDuplicates: true,
  });
  return user;
}

async function main() {
  for (const [name, label, desc] of [
    ["MEMBER", "Member", "Basic"],
    ["FREELANCER", "Freelancer", "Freelance"],
    ["CLIENT", "Client", "Client"],
    ["FOUNDER", "Founder", "Founder"],
    ["ADMIN", "Admin", "Admin"],
    ["MASTER_ADMIN", "Master Admin", "Master Admin"],
  ]) {
    await prisma.role.upsert({ create: { description: desc, label, name: name as never }, update: {}, where: { name: name as never } });
  }

  for (const [slug, name, desc] of [
    ["software", "Software", "Software work"],
    ["services", "Services", "Professional services"],
    ["market", "Market", "Marketplace"],
  ]) {
    await prisma.opportunityCategory.upsert({ create: { description: desc, name, slug }, update: {}, where: { slug } });
  }

  const userA = await upsertUser("alice-test@perx.test", "alice_test", "Alice Test", "PUBLIC_BETA_USER", ["FREELANCER", "CLIENT"]);
  const userB = await upsertUser("bob-test@perx.test", "bob_test", "Bob Test", "PUBLIC_BETA_USER", ["FOUNDER", "CLIENT"]);
  const userC = await upsertUser("carol-test@perx.test", "carol_test", "Carol Test", "PUBLIC_BETA_USER", ["MEMBER"]);
  const masterAdmin = await upsertUser("admin-test@perx.test", "admin_test", "Admin Test", "PUBLIC_BETA_USER", ["MASTER_ADMIN"]);

  console.log("Users seeded:", { alice: userA.id, bob: userB.id, carol: userC.id, admin: masterAdmin.id });

  // Accepted connection A->B
  await prisma.connection.upsert({
    create: { requesterId: userA.id, receiverId: userB.id, status: "ACCEPTED" },
    update: { status: "ACCEPTED" },
    where: { requesterId_receiverId: { requesterId: userA.id, receiverId: userB.id } },
  });

  // Published service by Alice
  const category = await prisma.opportunityCategory.findUniqueOrThrow({ where: { slug: "services" } });
  await prisma.opportunity.upsert({
    create: {
      budgetMinMinor: BigInt(50000),
      budgetMaxMinor: BigInt(150000),
      categoryId: category.id,
      currency: "NGN",
      description: "Full-stack development service including API design, testing, and deployment.",
      location: "Lagos",
      moderationStatus: "APPROVED",
      ownerId: userA.id,
      publishedAt: new Date(),
      remote: true,
      slug: "alice-dev-service",
      status: "PUBLISHED",
      summary: "Professional full-stack development service.",
      title: "Full-stack development service",
      type: "SERVICE",
    },
    update: {},
    where: { slug: "alice-dev-service" },
  });

  // Published product by Bob
  const marketCat = await prisma.opportunityCategory.findUniqueOrThrow({ where: { slug: "market" } });
  await prisma.opportunity.upsert({
    create: {
      budgetMinMinor: BigInt(25000),
      budgetMaxMinor: BigInt(25000),
      categoryId: marketCat.id,
      currency: "NGN",
      description: "Mechanical keyboard in excellent condition with Cherry MX switches.",
      location: "Abuja",
      moderationStatus: "APPROVED",
      ownerId: userB.id,
      publishedAt: new Date(),
      remote: false,
      slug: "bob-mech-keyboard",
      status: "PUBLISHED",
      summary: "Mechanical keyboard for sale.",
      title: "Mechanical keyboard",
      type: "PRODUCT",
    },
    update: {},
    where: { slug: "bob-mech-keyboard" },
  });

  // Direct conversation A-B with a message
  let conversation = await prisma.conversation.findFirst({
    where: {
      opportunityId: null,
      participants: { some: { userId: userA.id } },
      AND: { participants: { some: { userId: userB.id } } },
    },
  });
  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: {
        participants: {
          create: [{ userId: userA.id }, { userId: userB.id }],
        },
      },
    });
  }
  const existingMsg = await prisma.message.findFirst({ where: { conversationId: conversation.id } });
  if (!existingMsg) {
    await prisma.message.create({
      data: { body: "Hello from Alice!", conversationId: conversation.id, senderId: userA.id },
    });
  }

  // Moderation case linked to the conversation
  let modCase = await prisma.moderationCase.findFirst({
    where: { conversationId: conversation.id },
  });
  if (!modCase) {
    modCase = await prisma.moderationCase.create({
      data: {
        category: "HARASSMENT",
        conversationId: conversation.id,
        messageId: existingMsg?.id ?? null,
        priority: "NORMAL",
        reportedUserId: userB.id,
        reporterId: userA.id,
        source: "MESSAGE_REPORT",
        status: "NEW",
        summary: "Test moderation case for admin verification.",
        targetId: existingMsg?.id ?? conversation.id,
        targetType: "MESSAGE",
        title: "Message report: harassment",
      },
    });
    await prisma.moderationCaseEvent.create({
      data: {
        actorId: userA.id,
        caseId: modCase.id,
        nextStatus: "NEW",
        note: "Case created from user report.",
        type: "case.opened",
      },
    });
  }

  // A deal in APPROVED status between A and B (qualifying partner transaction)
  let deal = await prisma.deal.findFirst({
    where: { proposal: { description: "Test proposal for qualifying deal" } },
  });
  if (!deal) {
    const proposal = await prisma.proposal.create({
      data: {
        amountMinor: BigInt(100000),
        currency: "NGN",
        deliveryDays: 7,
        description: "Test proposal for qualifying deal",
        opportunityId: (await prisma.opportunity.findUniqueOrThrow({ where: { slug: "alice-dev-service" } })).id,
        senderId: userB.id,
        status: "ACCEPTED",
      },
    });
    const proposalVersion = await prisma.proposalVersion.create({
      data: {
        acceptedAt: new Date(),
        amountMinor: proposal.amountMinor,
        createdById: userB.id,
        currency: proposal.currency,
        deliveryDays: proposal.deliveryDays,
        description: proposal.description,
        includedRevisions: proposal.revisions,
        proposalId: proposal.id,
        status: "ACCEPTED",
        submittedAt: proposal.createdAt,
        versionNumber: 1,
      },
    });
    deal = await prisma.deal.create({
      data: {
        opportunityId: proposal.opportunityId,
        proposalId: proposal.id,
        proposalVersionId: proposalVersion.id,
        settlementMode: "SIMULATED",
        status: "APPROVED",
        valueMinor: BigInt(100000),
        currency: "NGN",
        participants: {
          create: [
            { userId: userA.id, role: "client" },
            { userId: userB.id, role: "provider" },
          ],
        },
      },
    });
  }

  // A deal in IN_PROGRESS status (should NOT qualify as partner)
  let nonQualifyingDeal = await prisma.deal.findFirst({
    where: { proposal: { description: "Test proposal for non-qualifying deal" } },
  });
  if (!nonQualifyingDeal) {
    const proposal2 = await prisma.proposal.create({
      data: {
        amountMinor: BigInt(50000),
        currency: "NGN",
        deliveryDays: 14,
        description: "Test proposal for non-qualifying deal",
        opportunityId: (await prisma.opportunity.findUniqueOrThrow({ where: { slug: "alice-dev-service" } })).id,
        senderId: userC.id,
        status: "ACCEPTED",
      },
    });
    const proposalVersion2 = await prisma.proposalVersion.create({
      data: {
        acceptedAt: new Date(),
        amountMinor: proposal2.amountMinor,
        createdById: userC.id,
        currency: proposal2.currency,
        deliveryDays: proposal2.deliveryDays,
        description: proposal2.description,
        includedRevisions: proposal2.revisions,
        proposalId: proposal2.id,
        status: "ACCEPTED",
        submittedAt: proposal2.createdAt,
        versionNumber: 1,
      },
    });
    nonQualifyingDeal = await prisma.deal.create({
      data: {
        opportunityId: proposal2.opportunityId,
        proposalId: proposal2.id,
        proposalVersionId: proposalVersion2.id,
        settlementMode: "SIMULATED",
        status: "IN_PROGRESS",
        valueMinor: BigInt(50000),
        currency: "NGN",
        participants: {
          create: [
            { userId: userA.id, role: "client" },
            { userId: userC.id, role: "provider" },
          ],
        },
      },
    });
  }

  console.log("Test data seeded successfully.");
  console.log("Credentials: email=alice-test@perx.test, bob-test@perx.test, carol-test@perx.test, admin-test@perx.test");
  console.log("Password:", PASSWORD);
  console.log({ modCaseId: modCase.id, conversationId: conversation.id, dealId: deal.id });
}

main().catch((e) => { console.error("Seed failed:", e.message); process.exit(1); });
