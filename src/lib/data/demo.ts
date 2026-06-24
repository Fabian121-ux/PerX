export type DemoOpportunity = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  description: string;
  type: "JOB" | "FREELANCE_PROJECT";
  status: "PUBLISHED";
  moderationStatus: "APPROVED";
  category: { name: string; slug: string };
  owner: { name: string; username: string; trustScore: number };
  location: string;
  remote: boolean;
  budgetMinMinor: bigint;
  budgetMaxMinor: bigint;
  currency: string;
  skills: string[];
  publishedAt: Date;
};

export const demoCategories = [
  {
    description: "Product engineering, automation, and infrastructure work.",
    name: "Software",
    slug: "software",
  },
  {
    description: "Brand, product, UX, and visual design opportunities.",
    name: "Design",
    slug: "design",
  },
  {
    description: "Business operations, growth, and process work.",
    name: "Operations",
    slug: "operations",
  },
];

export const demoOpportunities: DemoOpportunity[] = [
  {
    budgetMaxMinor: 650000000n,
    budgetMinMinor: 350000000n,
    category: demoCategories[0],
    currency: "NGN",
    description:
      "We need a production-minded engineer to create a dashboard for marketplace operators. The work includes protected routes, status timelines, moderation queues, audit-friendly state changes, and a clean responsive interface for repeated daily use.",
    id: "demo-opportunity-1",
    location: "Remote",
    moderationStatus: "APPROVED",
    owner: { name: "Amara Okafor", trustScore: 82, username: "amara-okafor" },
    publishedAt: new Date("2026-06-01T09:00:00.000Z"),
    remote: true,
    skills: ["Next.js", "Prisma", "Security"],
    slug: "secure-marketplace-dashboard",
    status: "PUBLISHED",
    summary: "Design and implement an operations dashboard for proposals, deals, escrow states, and trust signals.",
    title: "Build a secure marketplace dashboard",
    type: "FREELANCE_PROJECT",
  },
  {
    budgetMaxMinor: 240000000n,
    budgetMinMinor: 120000000n,
    category: demoCategories[1],
    currency: "NGN",
    description:
      "The scope covers core visual direction, reusable UI components, empty states, form states, mobile navigation, and accessibility documentation for a trust-first opportunity ecosystem.",
    id: "demo-opportunity-2",
    location: "Hybrid",
    moderationStatus: "APPROVED",
    owner: { name: "Amara Okafor", trustScore: 82, username: "amara-okafor" },
    publishedAt: new Date("2026-06-04T11:00:00.000Z"),
    remote: true,
    skills: ["Design systems", "Accessibility", "Brand"],
    slug: "trust-led-brand-system",
    status: "PUBLISHED",
    summary: "Create a design system for a professional opportunity ecosystem with accessible components.",
    title: "Create a trust-led brand system",
    type: "JOB",
  },
];

export const demoProfiles = [
  {
    biography:
      "Building practical software products and using perX to structure high-trust delivery relationships.",
    completedDeals: 8,
    headline: "Founder hiring trusted product teams",
    location: "Lagos, Nigeria",
    name: "Amara Okafor",
    roles: ["Client", "Founder"],
    skills: ["Product strategy", "SaaS"],
    trustScore: 82,
    username: "amara-okafor",
  },
  {
    biography:
      "I design and build transaction-heavy web apps with clear milestones, documentation, and maintainable systems.",
    completedDeals: 14,
    headline: "Full-stack engineer for secure marketplaces",
    location: "Accra, Ghana",
    name: "Daniel Mensah",
    roles: ["Freelancer"],
    skills: ["Next.js", "PostgreSQL", "Prisma"],
    trustScore: 88,
    username: "daniel-mensah",
  },
];
