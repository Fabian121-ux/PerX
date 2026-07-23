export const policyOutcomes = [
  "ALLOW",
  "FLAG",
  "LIMIT",
  "BLOCK",
  "ESCALATE",
] as const;

export type PolicyOutcome = (typeof policyOutcomes)[number];

export const policyCategories = [
  "SPAM",
  "SCAM",
  "FRAUD",
  "HARASSMENT",
  "THREATS",
  "HATE_OR_DISCRIMINATION",
  "IMPERSONATION",
  "PROHIBITED_GOODS_OR_SERVICES",
  "SUSPICIOUS_PAYMENT_REQUEST",
  "PLATFORM_BYPASS",
  "PERSONAL_INFORMATION_EXPOSURE",
  "UNSAFE_LINK",
  "MISLEADING_CLAIMS",
  "ACCOUNT_ABUSE",
] as const;

export type PolicyCategory = (typeof policyCategories)[number];

export type PolicyEntityType =
  | "message"
  | "opportunity"
  | "profile"
  | "proposal"
  | "deal"
  | "review"
  | "support_ticket"
  | "report"
  | "marketplace_listing";

export type PolicyCheckInput = {
  actorId: string;
  content: string;
  entityId?: string;
  entityType: PolicyEntityType;
};

export type PolicyResult = {
  auditMetadata: {
    category: PolicyCategory;
    confidence: number;
    detectorId: string;
    outcome: PolicyOutcome;
    severity: "low" | "medium" | "high";
  };
  category: PolicyCategory;
  confidence: number;
  detectorId: string;
  internalReason: string;
  outcome: PolicyOutcome;
  severity: "low" | "medium" | "high";
  timestamp: Date;
  userMessage?: string;
};

type Rule = {
  category: PolicyCategory;
  detectorId: string;
  internalReason: string;
  outcome: PolicyOutcome;
  pattern: RegExp;
  severity: PolicyResult["severity"];
  userMessage?: string;
};

const rules: Rule[] = [
  {
    category: "PLATFORM_BYPASS",
    detectorId: "platform-bypass-contact-v1",
    internalReason: "Content asks the recipient to move protected work or payment off platform.",
    outcome: "FLAG",
    pattern: /\b(pay|message|contact|deal)\s+(me|us)?\s*(outside|off)\s+(perx|platform)\b/i,
    severity: "medium",
  },
  {
    category: "SUSPICIOUS_PAYMENT_REQUEST",
    detectorId: "advance-payment-request-v1",
    internalReason: "Content includes a suspicious advance-payment request.",
    outcome: "ESCALATE",
    pattern: /\b(send|wire|transfer)\b.{0,40}\b(upfront|advance|crypto|gift card|western union)\b/i,
    severity: "high",
    userMessage:
      "This message needs review before it can be sent because it appears to request an unsafe payment.",
  },
  {
    category: "UNSAFE_LINK",
    detectorId: "unsafe-link-shortener-v1",
    internalReason: "Content contains a shortened URL commonly used to obscure destinations.",
    outcome: "FLAG",
    pattern: /\b(bit\.ly|tinyurl\.com|t\.co|goo\.gl|ow\.ly)\//i,
    severity: "medium",
  },
  {
    category: "THREATS",
    detectorId: "violent-threat-v1",
    internalReason: "Content appears to contain a threat of harm.",
    outcome: "BLOCK",
    pattern: /\b(i will|i'm going to|im going to)\s+(hurt|kill|attack|destroy)\b/i,
    severity: "high",
    userMessage:
      "This message cannot be sent because it appears to contain a threat.",
  },
  {
    category: "SPAM",
    detectorId: "repeated-promo-v1",
    internalReason: "Content appears to contain repetitive promotional language.",
    outcome: "LIMIT",
    pattern: /\b(guaranteed|risk free|act now|limited offer)\b.*\b(guaranteed|risk free|act now|limited offer)\b/i,
    severity: "low",
    userMessage:
      "Please revise this message before sending. It looks too promotional for a trusted work conversation.",
  },
];

const outcomeRank: Record<PolicyOutcome, number> = {
  ALLOW: 0,
  FLAG: 1,
  LIMIT: 2,
  BLOCK: 3,
  ESCALATE: 4,
};

function resultFromRule(rule: Rule): PolicyResult {
  const confidence = rule.severity === "high" ? 0.86 : rule.severity === "medium" ? 0.7 : 0.55;

  return {
    auditMetadata: {
      category: rule.category,
      confidence,
      detectorId: rule.detectorId,
      outcome: rule.outcome,
      severity: rule.severity,
    },
    category: rule.category,
    confidence,
    detectorId: rule.detectorId,
    internalReason: rule.internalReason,
    outcome: rule.outcome,
    severity: rule.severity,
    timestamp: new Date(),
    userMessage: rule.userMessage,
  };
}

export function evaluatePolicy(input: PolicyCheckInput): PolicyResult {
  const content = input.content.trim();
  const matches = rules
    .filter((rule) => rule.pattern.test(content))
    .map(resultFromRule);

  if (!matches.length) {
    return {
      auditMetadata: {
        category: "ACCOUNT_ABUSE",
        confidence: 0,
        detectorId: "allow-default-v1",
        outcome: "ALLOW",
        severity: "low",
      },
      category: "ACCOUNT_ABUSE",
      confidence: 0,
      detectorId: "allow-default-v1",
      internalReason: "No deterministic beta policy rule matched.",
      outcome: "ALLOW",
      severity: "low",
      timestamp: new Date(),
    };
  }

  return matches.sort(
    (left, right) => outcomeRank[right.outcome] - outcomeRank[left.outcome],
  )[0];
}

export function isPolicyBlocking(result: PolicyResult) {
  return result.outcome === "BLOCK" || result.outcome === "ESCALATE";
}
