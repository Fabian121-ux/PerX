/* eslint-disable @typescript-eslint/no-explicit-any */
import { calculateTrustSummary } from "@/lib/trust/engine";

type ProfileRecord = Record<string, any>;

export function normalizePublicProfile(profile: ProfileRecord) {
  const details: ProfileRecord =
    profile.profile && typeof profile.profile === "object"
      ? profile.profile
      : {};
  const roles: string[] = Array.isArray(profile.roles)
    ? profile.roles
        .map((entry: any) =>
          typeof entry === "string"
            ? entry
            : (entry.role?.label ?? entry.role?.name ?? null),
        )
        .filter(Boolean)
    : [];
  const skillsSource = Array.isArray(details.skills)
    ? details.skills
    : Array.isArray(profile.skills)
      ? profile.skills
      : [];
  const skills: string[] = skillsSource
    .map((entry: any) => (typeof entry === "string" ? entry : entry.name))
    .filter(Boolean);
  const averageRating = Number(
    profile.trustRecordEvidence?.averageRating ?? 0,
  );
  const completedDeals = Number(
    profile.trustRecordEvidence?.completedAgreements ?? 0,
  );
  const publicReviewCount = Number(
    profile.trustRecordEvidence?.publicReviewCount ?? 0,
  );
  const profileCompleteness = Number(
    details.profileCompleteness ?? profile.profileCompleteness ?? 0,
  );

  return {
    allowConnectionRequests: details.allowConnectionRequests ?? true,
    allowMessagesFromConnections:
      details.allowMessagesFromConnections ?? true,
    allowMessagesFromMembers: details.allowMessagesFromMembers ?? false,
    averageRating: Number.isFinite(averageRating) ? averageRating : 0,
    biography:
      details.biography ??
      profile.biography ??
      "This member has not completed a biography.",
    completedDeals,
    createdAt: profile.createdAt ?? null,
    emailVerified: Boolean(profile.emailVerifiedAt),
    headline: details.headline ?? profile.headline ?? "perX member",
    id: profile.id,
    isVerified: profile.verificationStatus === "VERIFIED",
    location:
      details.showLocation === false
        ? null
        : (details.location ?? profile.location ?? null),
    name: profile.name ?? "perX member",
    opportunities: Array.isArray(profile.opportunities)
      ? profile.opportunities
      : [],
    portfolio: Array.isArray(details.portfolio) ? details.portfolio : [],
    profileCompleteness,
    profileImageUrl:
      details.profileImageUrl ??
      profile.profileImageUrl ??
      profile.imageUrl ??
      "",
    publicReviewCount,
    reviews: Array.isArray(profile.reviewsReceived)
      ? profile.reviewsReceived
      : [],
    roles,
    skills: details.showSkills === false ? [] : skills,
    trust: calculateTrustSummary({
      averageRating,
      completedDeals,
      emailVerifiedAt: profile.emailVerifiedAt ?? null,
      profileCompleteness,
      verificationStatus: profile.verificationStatus,
    }),
    websiteUrl: normalizeProfileWebsite(details.websiteUrl),
    workHistory: Array.isArray(details.workHistory) ? details.workHistory : [],
  };
}

export function formatProfileDateRange(
  startedAt?: Date | string | null,
  endedAt?: Date | string | null,
) {
  if (!startedAt && !endedAt) return null;
  const start = startedAt ? formatProfileMonth(startedAt) : null;
  const end = endedAt ? formatProfileMonth(endedAt) : "Present";
  return [start, end].filter(Boolean).join(" - ");
}

function formatProfileMonth(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en", {
    month: "short",
    year: "numeric",
  });
}

function normalizeProfileWebsite(value: unknown) {
  if (typeof value !== "string" || !value) return null;
  try {
    const url = new URL(value);
    return new Set(["http:", "https:"]).has(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}
