import type { PublicTrustSummary } from "@/lib/trust/engine";

export type TrustFactorState =
  | "available"
  | "in-progress"
  | "met"
  | "unavailable";

export type TrustPresentationFactor = {
  detail: string;
  key:
    | "agreements"
    | "email"
    | "profile"
    | "reviews"
    | "verification";
  label: string;
  progress?: number;
  state: TrustFactorState;
};

export type AuthoritativeTrustScore = {
  factors: readonly TrustPresentationFactor[];
  lastUpdatedAt: string;
  maximum: number;
  methodologyVersion: string;
  source: "authoritative";
  value: number;
};

export type TrustScorePresentation =
  | {
      kind: "authoritative";
      lastUpdatedAt: string;
      maximum: number;
      methodologyVersion: string;
      normalizedValue: number;
      value: number;
    }
  | {
      kind: "not-published";
      reason: "methodology-not-approved" | "not-enough-authoritative-data";
    };

export type TrustPresentation = {
  contractVersion: "b3-trust-presentation-v1";
  factors: readonly TrustPresentationFactor[];
  guidance: readonly string[];
  score: TrustScorePresentation;
  summary: PublicTrustSummary;
  verification: {
    detail: string;
    label: string;
    state: "not-disclosed" | "pending" | "unverified" | "verified";
  };
};

export function createTrustPresentation({
  authoritativeScore,
  averageRating = 0,
  completedAgreements = 0,
  emailVerified = false,
  profileCompleteness = 0,
  publicReviewCount = 0,
  summary,
  verificationStatus,
  viewer = "owner",
}: {
  authoritativeScore?: AuthoritativeTrustScore | null;
  averageRating?: number;
  completedAgreements?: number;
  emailVerified?: boolean;
  profileCompleteness?: number;
  publicReviewCount?: number;
  summary: PublicTrustSummary;
  verificationStatus?: string | null;
  viewer?: "owner" | "public";
}): TrustPresentation {
  const normalizedProfileCompleteness = clamp(profileCompleteness, 0, 100);
  const factors: TrustPresentationFactor[] = authoritativeScore
    ? [...authoritativeScore.factors]
    : [
        {
          detail: normalizedProfileCompleteness
            ? `${Math.round(normalizedProfileCompleteness)}% of the current profile checklist is complete.`
            : "Add a headline, biography, location, skills, and profile image.",
          key: "profile",
          label: "Profile completeness",
          progress: normalizedProfileCompleteness,
          state:
            normalizedProfileCompleteness >= 80
              ? "met"
              : normalizedProfileCompleteness > 0
                ? "in-progress"
                : "available",
        },
        {
          detail: emailVerified
            ? "The account email has been verified."
            : "Email verification is not yet recorded.",
          key: "email",
          label: "Email verification",
          state: emailVerified ? "met" : "available",
        },
        {
          detail:
            verificationStatus === "VERIFIED"
              ? "PerX verification has been approved."
              : viewer === "owner"
                ? "PerX verification has not been approved yet."
                : "Additional verification is not publicly disclosed.",
          key: "verification",
          label: "Account verification",
          state:
            verificationStatus === "VERIFIED"
              ? "met"
              : viewer === "owner"
                ? "available"
                : "unavailable",
        },
        {
          detail: completedAgreements
            ? `${completedAgreements} completed ${completedAgreements === 1 ? "agreement is" : "agreements are"} recorded.`
            : "No eligible completed agreements are recorded yet.",
          key: "agreements",
          label: "Completed agreements",
          state: completedAgreements ? "met" : "available",
        },
        {
          detail: publicReviewCount
            ? `${publicReviewCount} public ${publicReviewCount === 1 ? "review" : "reviews"}${averageRating ? ` averaging ${averageRating.toFixed(1)}/5` : ""}.`
            : "No eligible public reviews are recorded yet.",
          key: "reviews",
          label: "Public reviews",
          state: publicReviewCount ? "met" : "available",
        },
      ];

  const guidance = factors
    .filter((factor) => factor.state !== "met" && factor.state !== "unavailable")
    .map((factor) => guidanceForFactor(factor.key));

  return {
    contractVersion: "b3-trust-presentation-v1",
    factors,
    guidance,
    score: authoritativeScore
      ? {
          kind: "authoritative",
          lastUpdatedAt: authoritativeScore.lastUpdatedAt,
          maximum: authoritativeScore.maximum,
          methodologyVersion: authoritativeScore.methodologyVersion,
          normalizedValue: normalizeScore(
            authoritativeScore.value,
            authoritativeScore.maximum,
          ),
          value: authoritativeScore.value,
        }
      : {
          kind: "not-published",
          reason: "methodology-not-approved",
        },
    summary,
    verification: verificationPresentation(verificationStatus, viewer),
  };
}

export function normalizeScore(value: number, maximum: number) {
  if (!Number.isFinite(value) || !Number.isFinite(maximum) || maximum <= 0) {
    return 0;
  }
  return Math.round(clamp((value / maximum) * 100, 0, 100));
}

function verificationPresentation(
  status: string | null | undefined,
  viewer: "owner" | "public",
): TrustPresentation["verification"] {
  if (status === "VERIFIED") {
    return {
      detail: "PerX verification has been approved for this account.",
      label: "Verified",
      state: "verified",
    };
  }
  if (viewer === "public") {
    return {
      detail: "No additional verification status is publicly disclosed.",
      label: "Not disclosed",
      state: "not-disclosed",
    };
  }
  if (status === "PENDING") {
    return {
      detail: "Verification is awaiting review.",
      label: "Pending review",
      state: "pending",
    };
  }
  return {
    detail: "Verification has not been approved yet.",
    label: "Not verified",
    state: "unverified",
  };
}

function guidanceForFactor(key: TrustPresentationFactor["key"]) {
  if (key === "profile") return "Complete the remaining public profile fields.";
  if (key === "email") return "Verify the account email when verification becomes available.";
  if (key === "verification") return "Follow the verification guidance shown on your account.";
  if (key === "agreements") return "Complete eligible agreements through PerX records.";
  return "Build record-backed feedback through eligible completed agreements.";
}

function clamp(value: number, minimum: number, maximum: number) {
  if (!Number.isFinite(value)) return minimum;
  return Math.min(maximum, Math.max(minimum, value));
}
