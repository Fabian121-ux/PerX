import "dotenv/config";
import bcrypt from "bcryptjs";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";

const databaseUrl =
  process.env.DIRECT_URL ??
  process.env.DATABASE_URL ??
  "postgresql://perx:perx_password@localhost:5432/perx?schema=public";

const pool = new Pool({ connectionString: databaseUrl });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// ── Role definitions ──────────────────────────────────────────────────
const roles = [
  ["FREELANCER", "Freelancer", "Sells skilled delivery capacity."],
  ["CLIENT", "Client", "Publishes opportunities and accepts proposals."],
  ["FOUNDER", "Founder", "Builds venture and partnership opportunities."],
  ["INVESTOR", "Investor", "Evaluates investment opportunities."],
  ["PROPERTY_OWNER", "Property Owner", "Creates property-backed opportunities."],
  ["ADMIN", "Admin", "Moderates and operates the platform."],
] as const;

// ── Category definitions ──────────────────────────────────────────────
const categories = [
  ["software", "Software", "Product engineering, automation, and infrastructure work."],
  ["design", "Design", "Brand, product, UX, and visual design opportunities."],
  ["operations", "Operations", "Business operations, growth, and process work."],
] as const;

async function main() {
  console.log("Seeding perX database...\n");

  // ── Roles ───────────────────────────────────────────────────────────
  for (const [name, label, description] of roles) {
    await prisma.role.upsert({
      where: { name },
      update: { label, description },
      create: { name, label, description },
    });
  }
  console.log("✓ Roles seeded");

  // ── Categories ──────────────────────────────────────────────────────
  for (const [slug, name, description] of categories) {
    await prisma.opportunityCategory.upsert({
      where: { slug },
      update: { name, description },
      create: { slug, name, description },
    });
  }
  console.log("✓ Categories seeded");

  // ── Development test user ───────────────────────────────────────────
  const devEmail = process.env.DEV_TEST_USER_EMAIL;
  const devUsername = process.env.DEV_TEST_USER_USERNAME;
  const devPassword = process.env.DEV_TEST_USER_PASSWORD;

  if (devEmail && devUsername && devPassword) {
    const passwordHash = await bcrypt.hash(devPassword, 12);

    const devUser = await prisma.user.upsert({
      where: { email: devEmail },
      update: { passwordHash },
      create: {
        email: devEmail,
        passwordHash,
        name: "Dev Test User",
        username: devUsername,
        verificationStatus: "UNVERIFIED",
        profile: {
          create: {
            headline: "Development test account",
            biography:
              "This is a local development test account for the perX platform. Sign in through the normal sign-in page.",
            location: "Local Development",
            trustScore: 0,
            profileCompleteness: 50,
          },
        },
      },
    });

    // Assign Freelancer, Client, Founder roles (never Admin)
    const roleRecords = await prisma.role.findMany({
      where: { name: { in: ["FREELANCER", "CLIENT", "FOUNDER"] } },
    });
    await prisma.userRole.createMany({
      data: roleRecords.map((role) => ({
        userId: devUser.id,
        roleId: role.id,
      })),
      skipDuplicates: true,
    });

    console.log(`✓ Dev test user seeded: ${devEmail} (${devUsername})`);
    console.log("  Roles: Freelancer, Client, Founder");
    console.log("  Admin: false");
  } else {
    console.log(
      "⚠ Dev test user skipped — set DEV_TEST_USER_EMAIL, DEV_TEST_USER_USERNAME, DEV_TEST_USER_PASSWORD in .env",
    );
  }

  // ── Optional admin seed user ────────────────────────────────────────
  const adminEmail = process.env.DEV_ADMIN_EMAIL;
  const adminUsername = process.env.DEV_ADMIN_USERNAME;
  const adminPassword = process.env.DEV_ADMIN_PASSWORD;

  if (adminEmail && adminUsername && adminPassword) {
    const adminPasswordHash = await bcrypt.hash(adminPassword, 12);

    const adminUser = await prisma.user.upsert({
      where: { email: adminEmail },
      update: { passwordHash: adminPasswordHash },
      create: {
        email: adminEmail,
        passwordHash: adminPasswordHash,
        name: "perX Admin",
        username: adminUsername,
        verificationStatus: "VERIFIED",
        profile: {
          create: {
            headline: "Platform operations",
            biography:
              "Moderates opportunities, disputes, reports, and verification requests.",
            location: "Remote",
            trustScore: 100,
            profileCompleteness: 100,
          },
        },
      },
    });

    const adminRole = await prisma.role.findUniqueOrThrow({
      where: { name: "ADMIN" },
    });
    await prisma.userRole.createMany({
      data: [{ userId: adminUser.id, roleId: adminRole.id }],
      skipDuplicates: true,
    });

    console.log(`✓ Admin seed user created: ${adminEmail} (${adminUsername})`);
    console.log("  Roles: Admin");
  } else {
    console.log(
      "⚠ Admin seed user skipped — set DEV_ADMIN_EMAIL, DEV_ADMIN_USERNAME, DEV_ADMIN_PASSWORD in .env",
    );
  }

  // ── Sample opportunities ────────────────────────────────────────────
  // Only create sample opportunities if the dev test user exists (as the owner)
  if (devEmail) {
    const owner = await prisma.user.findUnique({ where: { email: devEmail } });
    if (owner) {
      const software = await prisma.opportunityCategory.findUniqueOrThrow({
        where: { slug: "software" },
      });
      const design = await prisma.opportunityCategory.findUniqueOrThrow({
        where: { slug: "design" },
      });

      await prisma.opportunity.upsert({
        where: { slug: "secure-marketplace-dashboard" },
        update: {},
        create: {
          ownerId: owner.id,
          categoryId: software.id,
          type: "FREELANCE_PROJECT",
          status: "PUBLISHED",
          moderationStatus: "APPROVED",
          title: "Build a secure marketplace dashboard",
          slug: "secure-marketplace-dashboard",
          summary:
            "Design and implement an operations dashboard for proposals, deals, escrow states, and trust signals.",
          description:
            "We need a production-minded engineer to create a dashboard for marketplace operators. The work includes protected routes, status timelines, moderation queues, and audit-friendly state changes.",
          location: "Remote",
          remote: true,
          budgetMinMinor: BigInt(350000000),
          budgetMaxMinor: BigInt(650000000),
          currency: "NGN",
          skills: ["Next.js", "Prisma", "Security"],
          publishedAt: new Date(),
          statusHistory: {
            create: [
              {
                toStatus: "PUBLISHED",
                actorId: owner.id,
                note: "Seed opportunity published.",
              },
            ],
          },
        },
      });

      await prisma.opportunity.upsert({
        where: { slug: "trust-led-brand-system" },
        update: {},
        create: {
          ownerId: owner.id,
          categoryId: design.id,
          type: "JOB",
          status: "PUBLISHED",
          moderationStatus: "APPROVED",
          title: "Create a trust-led brand system",
          slug: "trust-led-brand-system",
          summary:
            "Create a design system for a professional opportunity ecosystem with accessible components.",
          description:
            "The scope covers core visual direction, reusable UI components, empty states, form states, mobile navigation, and accessibility documentation.",
          location: "Hybrid",
          remote: true,
          budgetMinMinor: BigInt(120000000),
          budgetMaxMinor: BigInt(240000000),
          currency: "NGN",
          skills: ["Design systems", "Accessibility", "Brand"],
          publishedAt: new Date(),
          statusHistory: {
            create: [
              {
                toStatus: "PUBLISHED",
                actorId: owner.id,
                note: "Seed opportunity published.",
              },
            ],
          },
        },
      });

      console.log("✓ Sample opportunities seeded");
    }
  }

  // ── Audit log entry ─────────────────────────────────────────────────
  await prisma.auditLog.create({
    data: {
      action: "seed.completed",
      entityType: "system",
      metadata: { source: "prisma/seed.ts", timestamp: new Date().toISOString() },
    },
  });

  console.log("\n✓ Seed complete.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
