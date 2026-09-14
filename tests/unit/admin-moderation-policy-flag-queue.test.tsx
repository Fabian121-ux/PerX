import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Policy-flag cases were created by nothing and counted by nobody. Even once
 * the case exists, an admin only learns about it if a queue surfaces it, so the
 * dashboard must count POLICY_FLAG separately from user-reported work.
 */

const mocks = vi.hoisted(() => ({
  disputeCount: vi.fn(),
  moderationCaseCount: vi.fn(),
  requireCapabilityOrNotFound: vi.fn(),
  userReportCount: vi.fn(),
  verificationCount: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  requireCapabilityOrNotFound: mocks.requireCapabilityOrNotFound,
}));
vi.mock("@/lib/db/prisma", () => ({
  getPrisma: () => ({
    dispute: { count: mocks.disputeCount },
    moderationCase: { count: mocks.moderationCaseCount },
    userReport: { count: mocks.userReportCount },
    verificationRequest: { count: mocks.verificationCount },
  }),
}));

import AdminModerationPage from "@/app/admin/moderation/page";

describe("admin moderation dashboard policy flag queue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireCapabilityOrNotFound.mockResolvedValue(undefined);
    mocks.disputeCount.mockResolvedValue(0);
    mocks.userReportCount.mockResolvedValue(0);
    mocks.verificationCount.mockResolvedValue(0);
    mocks.moderationCaseCount.mockResolvedValue(0);
  });

  it("counts open POLICY_FLAG cases", async () => {
    mocks.moderationCaseCount.mockImplementation(async (args) =>
      args?.where?.source === "POLICY_FLAG" ? 7 : 0,
    );

    const markup = renderToStaticMarkup(await AdminModerationPage());

    expect(markup).toContain("7");
    expect(markup).toMatch(/policy/i);
  });

  it("excludes resolved, dismissed and closed policy cases from the count", async () => {
    mocks.moderationCaseCount.mockResolvedValue(0);

    await AdminModerationPage();

    const policyCall = mocks.moderationCaseCount.mock.calls.find(
      (call) => call[0]?.where?.source === "POLICY_FLAG",
    );
    expect(policyCall).toBeDefined();
    expect(policyCall?.[0]?.where?.status).toEqual({
      notIn: ["RESOLVED", "DISMISSED", "CLOSED"],
    });
  });

  it("keeps the policy queue distinct from listing reports", async () => {
    mocks.moderationCaseCount.mockImplementation(async (args) =>
      args?.where?.source === "POLICY_FLAG" ? 3 : 0,
    );

    await AdminModerationPage();

    const sources = mocks.moderationCaseCount.mock.calls.map(
      (call) => call[0]?.where?.source,
    );
    // Both must be counted independently: a policy flag is not a user report.
    expect(sources).toContain("POLICY_FLAG");
    expect(sources).toContain("LISTING_REPORT");
  });

  it("does not render the empty state when only policy flags are open", async () => {
    mocks.moderationCaseCount.mockImplementation(async (args) =>
      args?.where?.source === "POLICY_FLAG" ? 2 : 0,
    );

    const markup = renderToStaticMarkup(await AdminModerationPage());

    expect(markup).not.toContain("No active moderation queues");
  });
});
