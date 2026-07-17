import "dotenv/config";
import bcrypt from "bcryptjs";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";

const roles = [
  ["FREELANCER", "Freelancer", "Sells skilled delivery capacity."],
  ["CLIENT", "Client", "Publishes opportunities and accepts proposals."],
  ["FOUNDER", "Founder", "Builds venture and partnership opportunities."],
  ["INVESTOR", "Investor", "Evaluates investment opportunities."],
  ["PROPERTY_OWNER", "Property Owner", "Creates property-backed opportunities."],
  ["ADMIN", "Admin", "Moderates and operates the platform."],
] as const;

const categories = [
  ["software", "Software", "Product engineering, automation, and infrastructure work."],
  ["design", "Design", "Brand, product, UX, and visual design opportunities."],
  ["operations", "Operations", "Business operations, growth, and process work."],
] as const;

const allowDevSeed = process.env.PERX_ALLOW_DEV_SEED === "true";
const allowSampleData = process.env.PERX_ALLOW_SAMPLE_DATA === "true";
const dryRun = process.env.PERX_SEED_DRY_RUN === "true";

function getSeedDatabaseUrl() {
  const databaseUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DIRECT_URL or DATABASE_URL is required before running prisma/seed.ts.");
  }
  return databaseUrl;
}

function isClearlyNonProductionSeedTarget() {
  const deployEnv = process.env.PERX_DEPLOY_ENV;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const databaseUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "";

  if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") {
    return false;
  }

  if (deployEnv === "development" || deployEnv === "staging" || deployEnv === "audit") {
    return true;
  }

  return appUrl.includes("localhost") || databaseUrl.includes("localhost") || databaseUrl.includes("127.0.0.1");
}

function assertOptionalSeedAllowed(kind: "development users" | "sample data") {
  if (!isClearlyNonProductionSeedTarget()) {
    throw new Error(
      `Refusing to seed ${kind}: set PERX_DEPLOY_ENV=development, staging, or audit and verify the database is non-production.`,
    );
  }
}

function printSeedSummary() {
  console.log("perX seed safety summary");
  console.log(`- Baseline roles: ${roles.length}`);
  console.log(`- Baseline categories: ${categories.length}`);
  console.log(`- Development users enabled: ${allowDevSeed}`);
  console.log(`- Sample marketplace data enabled: ${allowSampleData}`);
  console.log(`- Dry run: ${dryRun}`);
}

async function seedBaseline(prisma: PrismaClient) {
  for (const [name, label, description] of roles) {
    await prisma.role.upsert({
      create: { description, label, name },
      update: {},
      where: { name },
    });
  }

  for (const [slug, name, description] of categories) {
    await prisma.opportunityCategory.upsert({
      create: { description, name, slug },
      update: {},
      where: { slug },
    });
  }

  console.log("Baseline roles and categories seeded.");
}

async function seedDevelopmentUsers(prisma: PrismaClient) {
  if (!allowDevSeed) {
    console.log("Development users skipped. Set PERX_ALLOW_DEV_SEED=true to enable.");
    return null;
  }

  assertOptionalSeedAllowed("development users");

  const devEmail = process.env.DEV_TEST_USER_EMAIL;
  const devUsername = process.env.DEV_TEST_USER_USERNAME;
  const devPassword = process.env.DEV_TEST_USER_PASSWORD;

  if (!devEmail || !devUsername || !devPassword) {
    console.log("Development test user skipped. DEV_TEST_USER_EMAIL, DEV_TEST_USER_USERNAME, and DEV_TEST_USER_PASSWORD are required.");
    return null;
  }

  let devUser = await prisma.user.findUnique({ where: { email: devEmail } });
  if (devUser) {
    console.log("Development test user already exists; password hash was not changed.");
  } else {
    const passwordHash = await bcrypt.hash(devPassword, 12);
    devUser = await prisma.user.create({
      data: {
        email: devEmail,
        name: "Dev Test User",
        passwordHash,
        username: devUsername,
        verificationStatus: "UNVERIFIED",
        profile: {
          create: {
            biography: "This is a local development test account for the perX platform.",
            headline: "Development test account",
            location: "Local Development",
            profileCompleteness: 50,
            trustScore: 0,
          },
        },
      },
    });
    console.log("Development test user created.");
  }

  const roleRecords = await prisma.role.findMany({
    where: { name: { in: ["FREELANCER", "CLIENT", "FOUNDER"] } },
  });
  await prisma.userRole.createMany({
    data: roleRecords.map((role) => ({ roleId: role.id, userId: devUser.id })),
    skipDuplicates: true,
  });

  const adminEmail = process.env.DEV_ADMIN_EMAIL;
  const adminUsername = process.env.DEV_ADMIN_USERNAME;
  const adminPassword = process.env.DEV_ADMIN_PASSWORD;

  if (adminEmail && adminUsername && adminPassword) {
    let adminUser = await prisma.user.findUnique({ where: { email: adminEmail } });
    if (adminUser) {
      console.log("Admin seed user already exists; password hash was not changed.");
    } else {
      const passwordHash = await bcrypt.hash(adminPassword, 12);
      adminUser = await prisma.user.create({
        data: {
          email: adminEmail,
          name: "perX Admin",
          passwordHash,
          username: adminUsername,
          verificationStatus: "VERIFIED",
          profile: {
            create: {
              biography: "Moderates opportunities, disputes, reports, and verification requests.",
              headline: "Platform operations",
              location: "Remote",
              profileCompleteness: 100,
              trustScore: 100,
            },
          },
        },
      });
      console.log("Admin seed user created.");
    }

    const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: "ADMIN" } });
    await prisma.userRole.createMany({
      data: [{ roleId: adminRole.id, userId: adminUser.id }],
      skipDuplicates: true,
    });
  } else {
    console.log("Admin seed user skipped. DEV_ADMIN_EMAIL, DEV_ADMIN_USERNAME, and DEV_ADMIN_PASSWORD are required.");
  }

  return devUser;
}

async function seedSampleData(prisma: PrismaClient, ownerId: string | null) {
  if (!allowSampleData) {
    console.log("Sample marketplace data skipped. Set PERX_ALLOW_SAMPLE_DATA=true to enable.");
    return;
  }

  assertOptionalSeedAllowed("sample data");

  if (!ownerId) {
    console.log("Sample marketplace data skipped because no development owner exists.");
    return;
  }

  const software = await prisma.opportunityCategory.findUniqueOrThrow({
    where: { slug: "software" },
  });
  const design = await prisma.opportunityCategory.findUniqueOrThrow({
    where: { slug: "design" },
  });

  await prisma.opportunity.upsert({
    create: {
      budgetMaxMinor: BigInt(650000000),
      budgetMinMinor: BigInt(350000000),
      categoryId: software.id,
      currency: "NGN",
      description:
        "Create a dashboard for marketplace operators with protected routes, status timelines, moderation queues, and audit-friendly state changes.",
      location: "Remote",
      moderationStatus: "APPROVED",
      ownerId,
      publishedAt: new Date(),
      remote: true,
      skills: ["Next.js", "Prisma", "Security"],
      slug: "secure-marketplace-dashboard",
      status: "PUBLISHED",
      statusHistory: {
        create: [{ actorId: ownerId, note: "Seed opportunity published.", toStatus: "PUBLISHED" }],
      },
      summary:
        "Design and implement an operations dashboard for proposals, deals, escrow states, and trust signals.",
      title: "Build a secure marketplace dashboard",
      type: "FREELANCE_PROJECT",
    },
    update: {},
    where: { slug: "secure-marketplace-dashboard" },
  });

  await prisma.opportunity.upsert({
    create: {
      budgetMaxMinor: BigInt(240000000),
      budgetMinMinor: BigInt(120000000),
      categoryId: design.id,
      currency: "NGN",
      description:
        "Create core visual direction, reusable UI components, empty states, form states, mobile navigation, and accessibility documentation.",
      location: "Hybrid",
      moderationStatus: "APPROVED",
      ownerId,
      publishedAt: new Date(),
      remote: true,
      skills: ["Design systems", "Accessibility", "Brand"],
      slug: "trust-led-brand-system",
      status: "PUBLISHED",
      statusHistory: {
        create: [{ actorId: ownerId, note: "Seed opportunity published.", toStatus: "PUBLISHED" }],
      },
      summary:
        "Create a design system for a professional opportunity ecosystem with accessible components.",
      title: "Create a trust-led brand system",
      type: "JOB",
    },
    update: {},
    where: { slug: "trust-led-brand-system" },
  });

  console.log("Sample marketplace opportunities seeded.");
}

async function main() {
  printSeedSummary();

  if (dryRun) {
    console.log("Dry run complete. No database writes were performed.");
    return;
  }

  const pool = new Pool({ connectionString: getSeedDatabaseUrl() });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    await seedBaseline(prisma);
    const devUser = await seedDevelopmentUsers(prisma);
    await seedSampleData(prisma, devUser?.id ?? null);
    console.log("Seed complete.");
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Seed failed:", error instanceof Error ? error.message : "Unknown error");
  process.exitCode = 1;
});
