import "dotenv/config";
import bcrypt from "bcryptjs";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";

const roles = [
  ["MEMBER", "Member", "Basic PerX account membership."],
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

type SeedRoleName = (typeof roles)[number][0];

const allowDevSeed = process.env.PERX_ALLOW_DEV_SEED === "true";
const allowSampleData = process.env.PERX_ALLOW_SAMPLE_DATA === "true";
const dryRun = process.env.PERX_SEED_DRY_RUN === "true";
const seedDatabaseLabel = process.env.PERX_SEED_DATABASE_LABEL;

function getSeedDatabaseUrl() {
  const databaseUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DIRECT_URL or DATABASE_URL is required before running prisma/seed.ts.");
  }
  return databaseUrl;
}

function isClearlyNonProductionSeedTarget() {
  const deployEnv = process.env.PERX_DEPLOY_ENV;
  const databaseUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "";

  if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") {
    return false;
  }

  if (databaseUrl.includes("localhost") || databaseUrl.includes("127.0.0.1")) {
    return true;
  }

  if (
    seedDatabaseLabel &&
    (deployEnv === "development" || deployEnv === "staging")
  ) {
    return true;
  }

  return false;
}

function assertOptionalSeedAllowed(kind: "development users" | "sample data") {
  if (!isClearlyNonProductionSeedTarget()) {
    throw new Error(
      `Refusing to seed ${kind}: set PERX_DEPLOY_ENV=development or staging and verify the database is non-production.`,
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
  console.log(`- Remote seed target label present: ${Boolean(seedDatabaseLabel)}`);
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

type SeedAccountConfig = {
  accountClassification: "INTERNAL_ADMIN" | "INTERNAL_TEST_USER";
  biography: string;
  email: string;
  headline: string;
  location: string;
  name: string;
  password: string;
  profileCompleteness: number;
  roles: readonly SeedRoleName[];
  trustScore: number;
  username: string;
};

function readSeedAccount(
  kind: "normal test user" | "admin test user",
  fields: {
    email: string | undefined;
    password: string | undefined;
    username: string | undefined;
  },
  details: Omit<SeedAccountConfig, "email" | "password" | "username">,
) {
  const present = [fields.email, fields.username, fields.password].filter(Boolean).length;
  if (present === 0) return null;
  if (present !== 3) {
    throw new Error(
      `Refusing to create ${kind}: email, username, and password must all be provided.`,
    );
  }

  return {
    ...details,
    email: fields.email!.trim().toLowerCase(),
    password: fields.password!,
    username: fields.username!.trim().toLowerCase(),
  };
}

async function createSeedAccount(prisma: PrismaClient, config: SeedAccountConfig) {
  const existingByEmail = await prisma.user.findUnique({ where: { email: config.email } });
  const existingByUsername = await prisma.user.findUnique({ where: { username: config.username } });

  if (existingByEmail && existingByEmail.username !== config.username) {
    throw new Error(
      `Refusing to reuse ${config.email}: existing account username does not match DEV seed username.`,
    );
  }

  if (existingByUsername && existingByUsername.email !== config.email) {
    throw new Error(
      `Refusing to reuse ${config.username}: username already belongs to another account.`,
    );
  }

  let user = existingByEmail ?? existingByUsername;
  if (user) {
    console.log(`${config.name} already exists; password hash was not changed.`);
  } else {
    const passwordHash = await bcrypt.hash(config.password, 12);
    user = await prisma.user.create({
      data: {
        email: config.email,
        accountClassification: config.accountClassification,
        name: config.name,
        passwordHash,
        username: config.username,
        verificationStatus: config.roles.includes("ADMIN") ? "VERIFIED" : "UNVERIFIED",
        profile: {
          create: {
            biography: config.biography,
            headline: config.headline,
            location: config.location,
            profileCompleteness: config.profileCompleteness,
            trustScore: config.trustScore,
          },
        },
      },
    });
    console.log(`${config.name} created.`);
  }

  if (user.accountClassification !== config.accountClassification) {
    user = await prisma.user.update({
      data: { accountClassification: config.accountClassification },
      where: { id: user.id },
    });
    console.log(`${config.name} account classification verified.`);
  }

  const roleRecords = await prisma.role.findMany({
    where: { name: { in: [...config.roles] } },
  });
  await prisma.userRole.createMany({
    data: roleRecords.map((role) => ({ roleId: role.id, userId: user.id })),
    skipDuplicates: true,
  });
  console.log(`${config.name} roles verified.`);

  return user;
}

async function seedDevelopmentUsers(prisma: PrismaClient) {
  if (!allowDevSeed) {
    console.log("Development users skipped. Set PERX_ALLOW_DEV_SEED=true to enable.");
    return null;
  }

  assertOptionalSeedAllowed("development users");

  const normalAccount = readSeedAccount(
    "normal test user",
    {
      email: process.env.DEV_TEST_USER_EMAIL,
      password: process.env.DEV_TEST_USER_PASSWORD,
      username: process.env.DEV_TEST_USER_USERNAME,
    },
    {
      accountClassification: "INTERNAL_TEST_USER",
      biography: "This is a development test account for normal perX authenticated workflows.",
      headline: "Development test account",
      location: "Development",
      name: "Dev Test User",
      profileCompleteness: 60,
      roles: ["MEMBER", "FREELANCER", "CLIENT", "FOUNDER"],
      trustScore: 0,
    },
  );

  const adminAccount = readSeedAccount(
    "admin test user",
    {
      email: process.env.DEV_ADMIN_EMAIL,
      password: process.env.DEV_ADMIN_PASSWORD,
      username: process.env.DEV_ADMIN_USERNAME,
    },
    {
      accountClassification: "INTERNAL_ADMIN",
      biography: "This development account uses the real ADMIN role for admin-route testing.",
      headline: "Platform operations",
      location: "Development",
      name: "perX Admin",
      profileCompleteness: 100,
      roles: ["ADMIN"],
      trustScore: 100,
    },
  );

  const normalUser = normalAccount
    ? await createSeedAccount(prisma, normalAccount)
    : null;
  if (!normalAccount) {
    console.log("Normal test user skipped. DEV_TEST_USER_EMAIL, DEV_TEST_USER_USERNAME, and DEV_TEST_USER_PASSWORD are required.");
  }

  if (adminAccount) {
    await createSeedAccount(prisma, adminAccount);
  } else {
    console.log("Admin test user skipped. DEV_ADMIN_EMAIL, DEV_ADMIN_USERNAME, and DEV_ADMIN_PASSWORD are required.");
  }

  return normalUser;
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
