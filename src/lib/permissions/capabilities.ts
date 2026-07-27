export const roleLabels = {
  ADMIN: "Admin",
  CLIENT: "Client",
  FOUNDER: "Founder",
  FREELANCER: "Freelancer",
  INVESTOR: "Investor",
  MEMBER: "Member",
  MASTER_ADMIN: "Master Admin",
  PROPERTY_OWNER: "Property Owner",
  INTERNAL_TESTER: "Internal Tester",
} as const;

export type RoleName = keyof typeof roleLabels;

export type Capability =
  | "admin:access"
  | "admin:moderate"
  | "appeals:review"
  | "audit:read"
  | "broadcasts:create"
  | "conversation:read:participant"
  | "deal:transition:participant"
  | "deals:review"
  | "deal:view:participant"
  | "enforcement:manage"
  | "internal:tester"
  | "master:admin"
  | "opportunity:create"
  | "opportunity:moderate"
  | "opportunity:update:own"
  | "messages:moderate"
  | "policies:manage"
  | "proposal:create"
  | "proposal:decide:received"
  | "reports:review"
  | "review:create:eligible"
  | "settings:manage"
  | "support:manage"
  | "trust:configure"
  | "trust:read"
  | "trust:recalculate"
  | "trust:review"
  | "users:manage"
  | "users:read";

const capabilitiesByRole: Record<RoleName, Capability[]> = {
  MASTER_ADMIN: [
    "admin:access",
    "admin:moderate",
    "appeals:review",
    "audit:read",
    "broadcasts:create",
    "conversation:read:participant",
    "deal:transition:participant",
    "deals:review",
    "deal:view:participant",
    "enforcement:manage",
    "master:admin",
    "messages:moderate",
    "opportunity:create",
    "opportunity:moderate",
    "opportunity:update:own",
    "policies:manage",
    "proposal:create",
    "proposal:decide:received",
    "reports:review",
    "review:create:eligible",
    "settings:manage",
    "support:manage",
    "trust:configure",
    "trust:read",
    "trust:recalculate",
    "trust:review",
    "users:manage",
    "users:read",
  ],
  ADMIN: [
    "admin:access",
    "admin:moderate",
    "audit:read",
    "broadcasts:create",
    "conversation:read:participant",
    "deal:transition:participant",
    "deals:review",
    "deal:view:participant",
    "messages:moderate",
    "opportunity:create",
    "opportunity:moderate",
    "opportunity:update:own",
    "policies:manage",
    "proposal:create",
    "proposal:decide:received",
    "reports:review",
    "review:create:eligible",
    "settings:manage",
    "support:manage",
    "users:manage",
    "users:read",
  ],
  CLIENT: [
    "conversation:read:participant",
    "deal:transition:participant",
    "deal:view:participant",
    "opportunity:create",
    "opportunity:update:own",
    "proposal:decide:received",
    "review:create:eligible",
  ],
  FOUNDER: ["opportunity:create", "opportunity:update:own", "conversation:read:participant"],
  FREELANCER: [
    "conversation:read:participant",
    "deal:transition:participant",
    "deal:view:participant",
    "proposal:create",
    "review:create:eligible",
  ],
  INVESTOR: ["conversation:read:participant", "proposal:create"],
  MEMBER: [],
  PROPERTY_OWNER: ["opportunity:create", "opportunity:update:own", "conversation:read:participant"],
  INTERNAL_TESTER: ["internal:tester"],
};

export function getCapabilities(roles: RoleName[]) {
  return new Set(roles.flatMap((role) => capabilitiesByRole[role] ?? []));
}

export function hasCapability(roles: RoleName[], capability: Capability) {
  return getCapabilities(roles).has(capability);
}

export function normalizeRole(value: FormDataEntryValue | string): RoleName | null {
  const normalized = String(value).toUpperCase().replaceAll(" ", "_");
  return normalized in roleLabels ? (normalized as RoleName) : null;
}
