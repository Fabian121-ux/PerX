export type TrustLevel =
  | "NEW"
  | "BUILDING"
  | "ESTABLISHED"
  | "STRONG"
  | "RESTRICTED"
  | "UNDER_REVIEW";

export type PublicTrustSummary = {
  calculationVersion: string;
  description: string;
  evidence: string[];
  evidenceCount: number;
  label: string;
  level: TrustLevel;
  score: null;
  shortLabel: string;
};

export type TrustCalculationInput = {
  activeSuspension?: boolean;
  averageRating?: number | string | null;
  completedDeals?: number | string | null;
  confirmedPolicyViolations?: number | null;
  confirmedReports?: number | null;
  emailVerifiedAt?: Date | string | null;
  profileCompleteness?: number | string | null;
  verificationStatus?: string | null;
};

const calculationVersion = "trust-v1-beta-evidence";

function toFiniteNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined) return 0;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return count === 1 ? singular : plural;
}

export function calculateTrustSummary(
  input: TrustCalculationInput = {},
): PublicTrustSummary {
  const profileCompleteness = Math.max(
    0,
    Math.min(100, toFiniteNumber(input.profileCompleteness)),
  );
  const completedDeals = Math.max(0, Math.floor(toFiniteNumber(input.completedDeals)));
  const averageRating = Math.max(0, toFiniteNumber(input.averageRating));
  const confirmedReports = Math.max(
    0,
    Math.floor(toFiniteNumber(input.confirmedReports)),
  );
  const confirmedPolicyViolations = Math.max(
    0,
    Math.floor(toFiniteNumber(input.confirmedPolicyViolations)),
  );
  const isVerified = input.verificationStatus === "VERIFIED";
  const evidence: string[] = [];

  if (profileCompleteness >= 80) evidence.push("Profile completed");
  else if (profileCompleteness > 0) evidence.push("Profile in progress");

  if (input.emailVerifiedAt) evidence.push("Email verified");
  if (isVerified) evidence.push("Verification approved");
  if (completedDeals > 0) {
    evidence.push(
      `${completedDeals} completed ${pluralize(completedDeals, "agreement")}`,
    );
  }
  if (averageRating > 0) {
    evidence.push(`${averageRating.toFixed(1)} public review rating`);
  }

  if (input.activeSuspension) {
    return {
      calculationVersion,
      description:
        "This account has an active restriction. Internal risk details are not public.",
      evidence,
      evidenceCount: evidence.length,
      label: "Restricted",
      level: "RESTRICTED",
      score: null,
      shortLabel: "Restricted",
    };
  }

  if (confirmedReports > 0 || confirmedPolicyViolations > 0) {
    return {
      calculationVersion,
      description:
        "A confirmed policy or moderation outcome is affecting this trust status.",
      evidence,
      evidenceCount: evidence.length + confirmedReports + confirmedPolicyViolations,
      label: "Under review",
      level: "UNDER_REVIEW",
      score: null,
      shortLabel: "Under review",
    };
  }

  let level: TrustLevel = "NEW";
  if (profileCompleteness >= 60 || evidence.length >= 2) level = "BUILDING";
  if (completedDeals >= 1 && (input.emailVerifiedAt || isVerified)) {
    level = "ESTABLISHED";
  }
  if (completedDeals >= 5 && averageRating >= 4.5 && isVerified) {
    level = "STRONG";
  }

  const content: Record<
    Exclude<TrustLevel, "RESTRICTED" | "UNDER_REVIEW">,
    { description: string; label: string; shortLabel: string }
  > = {
    BUILDING: {
      description:
        "This member has started adding verifiable profile or platform activity.",
      label: "Building trust",
      shortLabel: "Building",
    },
    ESTABLISHED: {
      description:
        "This member has completed eligible platform activity backed by stored records.",
      label: "Established",
      shortLabel: "Established",
    },
    NEW: {
      description:
        "Not enough verified PerX activity exists yet to show a stronger trust level.",
      label: "New member",
      shortLabel: "New",
    },
    STRONG: {
      description:
        "This member has a stronger record of verified profile and completed agreement signals.",
      label: "Strong trust",
      shortLabel: "Strong",
    },
  };

  return {
    calculationVersion,
    description: content[level].description,
    evidence,
    evidenceCount: evidence.length,
    label: content[level].label,
    level,
    score: null,
    shortLabel: content[level].shortLabel,
  };
}

export function trustBadgeClassName(level: TrustLevel) {
  switch (level) {
    case "STRONG":
    case "ESTABLISHED":
      return "border-green-200 bg-green-50 text-green-800";
    case "UNDER_REVIEW":
      return "border-amber-200 bg-amber-50 text-amber-900";
    case "RESTRICTED":
      return "border-red-200 bg-red-50 text-red-800";
    case "BUILDING":
      return "border-blue-200 bg-blue-50 text-blue-800";
    case "NEW":
    default:
      return "border-[color:var(--px-border)] bg-[color:var(--px-surface-soft)] text-[color:var(--px-text-muted)]";
  }
}
