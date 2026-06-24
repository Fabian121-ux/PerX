export type TrustSignalInput = {
  key: string;
  label: string;
  value: number;
  weight: number;
  reason: string;
};

export function calculateTrustScore(signals: TrustSignalInput[]) {
  if (signals.length === 0) {
    return {
      breakdown: [],
      score: 0,
    };
  }

  const totalWeight = signals.reduce((sum, signal) => sum + signal.weight, 0);
  const weighted = signals.reduce((sum, signal) => sum + signal.value * signal.weight, 0);
  const score = Math.max(0, Math.min(100, Math.round(weighted / totalWeight)));

  return {
    breakdown: signals.map((signal) => ({
      ...signal,
      contribution: Math.round((signal.value * signal.weight) / totalWeight),
    })),
    score,
  };
}

export function defaultTrustSignals(input: {
  verified: boolean;
  profileCompleteness: number;
  completedDeals: number;
  successfulDeliveries: number;
  averageRating: number;
  disputes: number;
  moderationActions: number;
}) {
  return [
    {
      key: "verification",
      label: "Verification",
      reason: input.verified ? "Identity or account verification is complete." : "Verification is not complete.",
      value: input.verified ? 100 : 20,
      weight: 20,
    },
    {
      key: "profile",
      label: "Profile completeness",
      reason: "Complete profiles make collaboration safer and easier to evaluate.",
      value: input.profileCompleteness,
      weight: 15,
    },
    {
      key: "deals",
      label: "Completed deals",
      reason: "Completed deals show delivery history.",
      value: Math.min(100, input.completedDeals * 10),
      weight: 20,
    },
    {
      key: "deliveries",
      label: "Successful deliveries",
      reason: "Approved deliveries indicate reliable execution.",
      value: Math.min(100, input.successfulDeliveries * 8),
      weight: 20,
    },
    {
      key: "ratings",
      label: "Ratings",
      reason: "Ratings are included only after eligible completed deals.",
      value: Math.round((input.averageRating / 5) * 100),
      weight: 15,
    },
    {
      key: "risk",
      label: "Risk adjustments",
      reason: "Disputes and moderation history reduce confidence.",
      value: Math.max(0, 100 - input.disputes * 20 - input.moderationActions * 25),
      weight: 10,
    },
  ];
}
