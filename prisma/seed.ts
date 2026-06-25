import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaPg(process.env.DATABASE_URL ?? "postgresql://perx:perx_password@localhost:5432/perx?schema=public"),
});

const roles = [
  ["FREELANCER", "Freelancer", "Sells skilled delivery capacity."],
  ["CLIENT", "Client", "Publishes opportunities and accepts proposals."],
  ["FOUNDER", "Founder", "Builds venture and partnership opportunities."],
  ["INVESTOR", "Investor", "Evaluates investment opportunities."],
  ["PROPERTY_OWNER", "Property Owner", "Creates property-backed opportunities."],
  ["ADMIN", "Admin", "Moderates and operates the platform."],
] as const;

async function main() {
  for (const [name, label, description] of roles) {
    await prisma.role.upsert({
      where: { name },
      update: { label, description },
      create: { name, label, description },
    });
  }

  const categories = [
    ["software", "Software", "Product engineering, automation, and infrastructure work."],
    ["design", "Design", "Brand, product, UX, and visual design opportunities."],
    ["operations", "Operations", "Business operations, growth, and process work."],
  ] as const;

  for (const [slug, name, description] of categories) {
    await prisma.opportunityCategory.upsert({
      where: { slug },
      update: { name, description },
      create: { slug, name, description },
    });
  }

  const passwordHash = await bcrypt.hash("perX-demo-password", 12);
  const client = await prisma.user.upsert({
    where: { email: "client@perx.local" },
    update: {},
    create: {
      email: "client@perx.local",
      passwordHash,
      name: "Amara Okafor",
      username: "amara-okafor",
      verificationStatus: "VERIFIED",
      profile: {
        create: {
          headline: "Founder hiring trusted product teams",
          biography:
            "Building practical software products and using perX to structure high-trust delivery relationships.",
          location: "Lagos, Nigeria",
          trustScore: 82,
          profileCompleteness: 92,
          completedDeals: 8,
          averageRating: "4.8",
          skills: { create: [{ name: "Product strategy" }, { name: "SaaS" }] },
        },
      },
    },
  });

  const freelancer = await prisma.user.upsert({
    where: { email: "freelancer@perx.local" },
    update: {},
    create: {
      email: "freelancer@perx.local",
      passwordHash,
      name: "Daniel Mensah",
      username: "daniel-mensah",
      verificationStatus: "VERIFIED",
      profile: {
        create: {
          headline: "Full-stack engineer for secure marketplaces",
          biography:
            "I design and build transaction-heavy web apps with clear milestones, documentation, and maintainable systems.",
          location: "Accra, Ghana",
          trustScore: 88,
          profileCompleteness: 96,
          completedDeals: 14,
          averageRating: "4.9",
          skills: { create: [{ name: "Next.js" }, { name: "PostgreSQL" }, { name: "Prisma" }] },
        },
      },
    },
  });

  const admin = await prisma.user.upsert({
    where: { email: "admin@perx.local" },
    update: {},
    create: {
      email: "admin@perx.local",
      passwordHash,
      name: "perX Admin",
      username: "perx-admin",
      verificationStatus: "VERIFIED",
      profile: {
        create: {
          headline: "Platform operations",
          biography: "Moderates opportunities, disputes, reports, and verification requests.",
          location: "Remote",
          trustScore: 100,
          profileCompleteness: 100,
        },
      },
    },
  });

  const roleRecords = await prisma.role.findMany();
  const byName = Object.fromEntries(roleRecords.map((role) => [role.name, role.id]));
  await prisma.userRole.createMany({
    data: [
      { userId: client.id, roleId: byName.CLIENT },
      { userId: client.id, roleId: byName.FOUNDER },
      { userId: freelancer.id, roleId: byName.FREELANCER },
      { userId: admin.id, roleId: byName.ADMIN },
    ],
    skipDuplicates: true,
  });

  const software = await prisma.opportunityCategory.findUniqueOrThrow({ where: { slug: "software" } });
  const design = await prisma.opportunityCategory.findUniqueOrThrow({ where: { slug: "design" } });

  await prisma.opportunity.upsert({
    where: { slug: "secure-marketplace-dashboard" },
    update: {},
    create: {
      ownerId: client.id,
      categoryId: software.id,
      type: "FREELANCE_PROJECT",
      status: "PUBLISHED",
      moderationStatus: "APPROVED",
      title: "Build a secure marketplace dashboard",
      slug: "secure-marketplace-dashboard",
      summary: "Design and implement an operations dashboard for proposals, deals, escrow states, and trust signals.",
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
        create: [{ toStatus: "PUBLISHED", actorId: client.id, note: "Seed opportunity published." }],
      },
    },
  });

  await prisma.opportunity.upsert({
    where: { slug: "trust-led-brand-system" },
    update: {},
    create: {
      ownerId: client.id,
      categoryId: design.id,
      type: "JOB",
      status: "PUBLISHED",
      moderationStatus: "APPROVED",
      title: "Create a trust-led brand system",
      slug: "trust-led-brand-system",
      summary: "Create a design system for a professional opportunity ecosystem with accessible components.",
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
        create: [{ toStatus: "PUBLISHED", actorId: client.id, note: "Seed opportunity published." }],
      },
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: admin.id,
      action: "seed.completed",
      entityType: "system",
      metadata: { source: "prisma/seed.ts" },
    },
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
