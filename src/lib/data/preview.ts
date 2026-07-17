export type PreviewUser = {
  id: string;
  name: string;
  username: string;
  email: string;
  headline: string;
  biography: string;
  location: string;
  roles: string[];
  skills: string[];
  trustScore: number;
  completedDeals: number;
};

export type PreviewOpportunity = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  description: string;
  type: "JOB" | "FREELANCE_PROJECT";
  status: "PUBLISHED" | "DRAFT" | "PAUSED" | "CLOSED" | "ARCHIVED";
  moderationStatus: "PENDING" | "APPROVED" | "REJECTED" | "FLAGGED";
  category: { name: string; slug: string };
  owner: { name: string; username: string; trustScore: number };
  location: string;
  remote: boolean;
  budgetMinMinor: number;
  budgetMaxMinor: number;
  currency: string;
  skills: string[];
  publishedAt: string;
};

export type PreviewProposal = {
  id: string;
  opportunityId: string;
  opportunity: { title: string; slug: string };
  senderId: string;
  sender: { name: string; username: string };
  amountMinor: number;
  currency: string;
  deliveryDays: number;
  description: string;
  status: "DRAFT" | "SENT" | "WITHDRAWN" | "ACCEPTED" | "REJECTED" | "COUNTERED" | "EXPIRED";
  revisions: number;
  createdAt: string;
  milestones: { id: string; title: string; description: string; amountMinor: number; currency: string; dueInDays: number }[];
};

export type PreviewMessage = {
  id: string;
  body: string;
  senderId: string;
  senderName: string;
  createdAt: string;
};

export type PreviewConversation = {
  id: string;
  opportunityTitle: string;
  opportunitySlug: string;
  participantName: string;
  participantUsername: string;
  lastMessage?: string;
  messages: PreviewMessage[];
};

export type PreviewMilestone = {
  id: string;
  title: string;
  description: string;
  amountMinor: number;
  currency: string;
  status: "PENDING" | "FUNDED" | "IN_PROGRESS" | "SUBMITTED" | "APPROVED" | "RELEASED" | "CANCELLED" | "DISPUTED";
};

export type PreviewDeal = {
  id: string;
  title: string;
  status: "DRAFT" | "AWAITING_FUNDING" | "FUNDED" | "IN_PROGRESS" | "SUBMITTED" | "UNDER_REVIEW" | "APPROVED" | "RELEASED" | "CANCELLED" | "DISPUTED";
  valueMinor: number;
  currency: string;
  participants: { id: string; name: string; username: string; role: string }[];
  milestones: PreviewMilestone[];
  deliveries: { id: string; title: string; notes: string; status: string; submitterId: string }[];
  ledgerEntries: { id: string; amountMinor: number; currency: string; note: string; type: string; createdAt: string }[];
  statusHistory: { id: string; toStatus: string; reason: string; createdAt: string }[];
};

export const previewUser: PreviewUser = {
  id: "alex-demo",
  name: "Alex Morgan",
  username: "alex-demo",
  email: "alex-demo@demo.perx.local",
  headline: "Product Designer and Startup Collaborator",
  biography: "Alex is a product designer and startup collaborator using perX to discover serious opportunities, negotiate structured work, and build a visible trust record.",
  location: "Toronto, Canada",
  roles: ["Freelancer", "Founder", "Client"],
  skills: ["Product design", "Marketplace UX", "Startup collaboration", "Design systems"],
  trustScore: 91,
  completedDeals: 11,
};

export const previewTrustBreakdown = [
  { key: "verification", label: "Verification", reason: "Verified professional profile.", value: 100, weight: 20 },
  { key: "profile", label: "Profile completeness", reason: "Profile includes headline, biography, skills, and roles.", value: 100, weight: 15 },
  { key: "deals", label: "Completed deals", reason: "11 completed deals on perX.", value: 90, weight: 20 },
  { key: "ratings", label: "Ratings", reason: "Fictional reviews average 5.0 stars.", value: 96, weight: 15 },
  { key: "risk", label: "Risk adjustments", reason: "No historical disputes or moderation flags.", value: 100, weight: 10 },
];

export const previewReviews = [
  {
    id: "rev-1",
    authorName: "Maya Chen",
    authorHeadline: "Client · Cross-border services",
    rating: 5,
    title: "Clear and trustworthy delivery",
    body: "Alex translated a complex trust workflow into clear, usable screens with excellent milestone communication.",
    createdAt: "2026-05-15",
  },
  {
    id: "rev-2",
    authorName: "Sam Rivera",
    authorHeadline: "Founder · Opportunity intelligence",
    rating: 5,
    title: "Outstanding UI Design",
    body: "Alex designed our MVP interface from scratch, including fully responsive patterns and high-fidelity designs. Fast turnaround.",
    createdAt: "2026-06-02",
  },
];

export const previewOpportunities: PreviewOpportunity[] = [
  {
    id: "opp-1",
    slug: "demo-trust-led-onboarding-redesign",
    title: "Trust-led onboarding redesign",
    summary: "Redesign onboarding and trust surfaces for a marketplace MVP.",
    description: "Fictional demo project to redesign onboarding, role selection, opportunity discovery, and trust explanations for an early-stage marketplace.",
    type: "FREELANCE_PROJECT",
    status: "PUBLISHED",
    moderationStatus: "APPROVED",
    category: { name: "Design", slug: "design" },
    owner: { name: "Maya Chen", username: "maya-client", trustScore: 86 },
    location: "Remote",
    remote: true,
    budgetMinMinor: 48000000,
    budgetMaxMinor: 82000000,
    currency: "NGN",
    skills: ["Product design", "Trust UX", "Design systems"],
    publishedAt: "2026-06-20T10:00:00Z",
  },
  {
    id: "opp-2",
    slug: "demo-secure-deal-dashboard",
    title: "Secure deal dashboard",
    summary: "Build a dashboard for proposals, milestones, deliveries, and simulated deal states.",
    description: "Fictional demo project for a secure deal dashboard with proposals, milestones, delivery review, simulated release states, reviews, and audit trails.",
    type: "FREELANCE_PROJECT",
    status: "PUBLISHED",
    moderationStatus: "APPROVED",
    category: { name: "Software", slug: "software" },
    owner: { name: "Alex Morgan", username: "alex-demo", trustScore: 91 },
    location: "Remote",
    remote: true,
    budgetMinMinor: 76000000,
    budgetMaxMinor: 120000000,
    currency: "NGN",
    skills: ["Next.js", "Prisma", "Escrow state machine"],
    publishedAt: "2026-06-21T11:30:00Z",
  },
  {
    id: "opp-3",
    slug: "demo-founder-collaboration-sprint",
    title: "Founder collaboration sprint",
    summary: "Run a structured sprint for a founder collaboration workflow.",
    description: "Fictional demo sprint for validating startup collaboration workflows, founder profiles, and structured proposal expectations.",
    type: "JOB",
    status: "PUBLISHED",
    moderationStatus: "APPROVED",
    category: { name: "Operations", slug: "operations" },
    owner: { name: "Sam Rivera", username: "sam-founder", trustScore: 78 },
    location: "London, UK",
    remote: false,
    budgetMinMinor: 30000000,
    budgetMaxMinor: 54000000,
    currency: "NGN",
    skills: ["Startup collaboration", "Research", "Go-to-market"],
    publishedAt: "2026-06-22T09:00:00Z",
  },
];

export const previewSavedOpportunities: PreviewOpportunity[] = [
  previewOpportunities[2],
];

export const previewProposals: PreviewProposal[] = [
  {
    id: "prop-sent-1",
    opportunityId: "opp-1",
    opportunity: { title: "Trust-led onboarding redesign", slug: "demo-trust-led-onboarding-redesign" },
    senderId: "alex-demo",
    sender: { name: "Alex Morgan", username: "alex-demo" },
    amountMinor: 64000000,
    currency: "NGN",
    deliveryDays: 28,
    description: "Discovery, UX structure, high-fidelity product screens, and design-system handoff for the fictional perX-style onboarding journey.",
    status: "ACCEPTED",
    revisions: 2,
    createdAt: "2026-06-23T14:00:00Z",
    milestones: [
      { id: "prop-m-1", title: "Discovery and flow map", description: "Audit onboarding, roles, trust moments, and conversion risks.", amountMinor: 18000000, currency: "NGN", dueInDays: 7 },
      { id: "prop-m-2", title: "Interface design system", description: "Produce high-fidelity responsive screens and component states.", amountMinor: 26000000, currency: "NGN", dueInDays: 18 },
      { id: "prop-m-3", title: "Handoff and review", description: "Package implementation notes and acceptance criteria.", amountMinor: 20000000, currency: "NGN", dueInDays: 28 },
    ],
  },
  {
    id: "prop-received-1",
    opportunityId: "opp-2",
    opportunity: { title: "Secure deal dashboard", slug: "demo-secure-deal-dashboard" },
    senderId: "riley-pro",
    sender: { name: "Riley Stone", username: "riley-pro" },
    amountMinor: 93000000,
    currency: "NGN",
    deliveryDays: 35,
    description: "Implementation proposal for secure proposal, deal, and simulated deal-state dashboard workflows.",
    status: "SENT",
    revisions: 1,
    createdAt: "2026-06-24T08:00:00Z",
    milestones: [
      { id: "prop-m-4", title: "Deal-state backend mapping", description: "Design database schemas and secure status machines.", amountMinor: 43000000, currency: "NGN", dueInDays: 15 },
      { id: "prop-m-5", title: "Dashboard frontend screens", description: "Connect server components with clean CSS layout shells.", amountMinor: 50000000, currency: "NGN", dueInDays: 35 },
    ],
  },
];

export const previewConversation: PreviewConversation = {
  id: "conv-1",
  opportunityTitle: "Trust-led onboarding redesign",
  opportunitySlug: "demo-trust-led-onboarding-redesign",
  participantName: "Maya Chen",
  participantUsername: "maya-client",
  lastMessage: "Confirmed. I will send a proposal with discovery, UX system, and handoff milestones.",
  messages: [
    { id: "msg-1", body: "Hi Maya, I reviewed the onboarding scope and can map the trust moments into milestone-based work.", senderId: "alex-demo", senderName: "Alex Morgan", createdAt: "2026-06-23T12:00:00Z" },
    { id: "msg-2", body: "That sounds right. Please include role selection and proposal confidence states in the first milestone.", senderId: "maya-client", senderName: "Maya Chen", createdAt: "2026-06-23T12:15:00Z" },
    { id: "msg-3", body: "Confirmed. I will send a proposal with discovery, UX system, and handoff milestones.", senderId: "alex-demo", senderName: "Alex Morgan", createdAt: "2026-06-23T12:30:00Z" },
  ],
};

export const previewConversations: PreviewConversation[] = [
  previewConversation,
];

export const previewActiveDeal: PreviewDeal = {
  id: "demo-deal",
  title: "Trust-led onboarding redesign",
  status: "RELEASED",
  valueMinor: 64000000,
  currency: "NGN",
  participants: [
    { id: "maya-client", name: "Maya Chen", username: "maya-client", role: "Client" },
    { id: "alex-demo", name: "Alex Morgan", username: "alex-demo", role: "Freelancer" },
  ],
  milestones: [
    { id: "dm-1", title: "Discovery and flow map", description: "Audit onboarding and role flows.", amountMinor: 18000000, currency: "NGN", status: "RELEASED" },
    { id: "dm-2", title: "Interface design system", description: "Create responsive screens.", amountMinor: 26000000, currency: "NGN", status: "RELEASED" },
    { id: "dm-3", title: "Handoff and review", description: "Handoff and review.", amountMinor: 20000000, currency: "NGN", status: "APPROVED" },
  ],
  deliveries: [
    { id: "del-1", title: "Discovery delivery", notes: "Uploaded fictional onboarding flow map and trust surface notes.", status: "APPROVED", submitterId: "alex-demo" },
  ],
  ledgerEntries: [
    { id: "led-1", amountMinor: 64000000, currency: "NGN", note: "Fictional simulated funding state. No real funds are collected or held by perX.", type: "FUNDING_HELD", createdAt: "2026-06-23T15:00:00Z" },
    { id: "led-2", amountMinor: 44000000, currency: "NGN", note: "Fictional simulated release state after approval. No real funds were released.", type: "RELEASE", createdAt: "2026-06-24T10:00:00Z" },
  ],
  statusHistory: [
    { id: "sh-1", toStatus: "AWAITING_FUNDING", reason: "Demo deal created.", createdAt: "2026-06-23T14:05:00Z" },
    { id: "sh-2", toStatus: "FUNDED", reason: "Fictional simulated funding state recorded.", createdAt: "2026-06-23T15:00:00Z" },
    { id: "sh-3", toStatus: "IN_PROGRESS", reason: "Work started.", createdAt: "2026-06-23T16:00:00Z" },
    { id: "sh-4", toStatus: "SUBMITTED", reason: "Delivery submitted.", createdAt: "2026-06-24T09:00:00Z" },
    { id: "sh-5", toStatus: "UNDER_REVIEW", reason: "Client review started.", createdAt: "2026-06-24T09:15:00Z" },
    { id: "sh-6", toStatus: "APPROVED", reason: "Delivery approved.", createdAt: "2026-06-24T09:45:00Z" },
    { id: "sh-7", toStatus: "RELEASED", reason: "Simulated release state recorded. No real funds were released.", createdAt: "2026-06-24T10:00:00Z" },
  ],
};

export const previewDeals: PreviewDeal[] = [
  previewActiveDeal,
];

export const previewNotifications = [
  { id: "notif-1", title: "Simulated release recorded", body: "Maya approved the discovery milestone and recorded a simulated release state.", type: "DEAL", read: false },
  { id: "notif-2", title: "Proposal received", body: "Riley submitted a proposal for Secure deal dashboard.", type: "PROPOSAL", read: false },
  { id: "notif-3", title: "Trust score updated", body: "Your trust score improved after a completed demo deal.", type: "REVIEW", read: true },
];
