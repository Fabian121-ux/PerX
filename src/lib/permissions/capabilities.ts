export const roleLabels = {
  ADMIN: "Admin",
  CLIENT: "Client",
  FOUNDER: "Founder",
  FREELANCER: "Freelancer",
  INVESTOR: "Investor",
  PROPERTY_OWNER: "Property Owner",
} as const;

export type RoleName = keyof typeof roleLabels;

export type Capability =
  | "admin:access"
  | "admin:moderate"
  | "conversation:read:participant"
  | "deal:transition:participant"
  | "deal:view:participant"
  | "opportunity:create"
  | "opportunity:moderate"
  | "opportunity:update:own"
  | "proposal:create"
  | "proposal:decide:received"
  | "review:create:eligible";

const capabilitiesByRole: Record<RoleName, Capability[]> = {
  ADMIN: [
    "admin:access",
    "admin:moderate",
    "conversation:read:participant",
    "deal:transition:participant",
    "deal:view:participant",
    "opportunity:create",
    "opportunity:moderate",
    "opportunity:update:own",
    "proposal:create",
    "proposal:decide:received",
    "review:create:eligible",
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
  PROPERTY_OWNER: ["opportunity:create", "opportunity:update:own", "conversation:read:participant"],
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
