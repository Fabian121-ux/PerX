import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findApplication: vi.fn(),
  hasDatabaseUrl: vi.fn(),
  requireCapabilityOrNotFound: vi.fn(),
  requireUser: vi.fn(),
  transaction: vi.fn(),
  upsertApplication: vi.fn(),
}));

const tx = vi.hoisted(() => ({
  auditLog: { create: vi.fn() },
  role: { upsert: vi.fn() },
  traderApplication: { updateMany: vi.fn() },
  userRole: { createMany: vi.fn(), deleteMany: vi.fn() },
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({
  requireCapabilityOrNotFound: mocks.requireCapabilityOrNotFound,
  requireUser: mocks.requireUser,
}));
vi.mock("@/lib/db/prisma", () => ({
  getPrisma: () => ({
    $transaction: mocks.transaction,
    traderApplication: {
      findUnique: mocks.findApplication,
      upsert: mocks.upsertApplication,
    },
  }),
}));
vi.mock("@/lib/env", () => ({ hasDatabaseUrl: mocks.hasDatabaseUrl }));
vi.mock("@/lib/options", () => ({
  opportunityCategoryOptions: [{ label: "Software", value: "software" }],
}));
vi.mock("@/lib/trader/access", () => ({ TRADER_GRANT_ROLE: "CLIENT" }));

import {
  decideTraderApplicationAction,
  submitTraderApplicationAction,
} from "@/features/trader/actions";

function decisionForm(decision = "APPROVED") {
  const formData = new FormData();
  formData.set("applicationId", "application-1");
  formData.set("decision", decision);
  return formData;
}

function applicationForm() {
  const formData = new FormData();
  formData.set("applicantKind", "INDIVIDUAL");
  formData.set(
    "experience",
    "I have several years of practical experience delivering software projects.",
  );
  formData.set("headline", "Software services and project delivery");
  formData.set("tradeCategory", "software");
  return formData;
}

describe("trader application actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.hasDatabaseUrl.mockReturnValue(true);
    mocks.requireCapabilityOrNotFound.mockResolvedValue({ id: "admin-1" });
    mocks.requireUser.mockResolvedValue({ id: "user-1" });
    mocks.transaction.mockImplementation((callback) => callback(tx));
    tx.traderApplication.updateMany.mockResolvedValue({ count: 1 });
    tx.role.upsert.mockResolvedValue({ id: "role-client" });
  });

  it("does not let a stale browser overwrite an application already under review", async () => {
    mocks.findApplication.mockResolvedValue({ status: "PENDING_REVIEW" });

    const result = await submitTraderApplicationAction(
      { status: "idle" },
      applicationForm(),
    );

    expect(result).toEqual(
      expect.objectContaining({
        status: "error",
        message: expect.stringMatching(/already under review/i),
      }),
    );
    expect(mocks.upsertApplication).not.toHaveBeenCalled();
  });

  it("guards the review write with the status the admin actually saw", async () => {
    mocks.findApplication.mockResolvedValue({
      id: "application-1",
      status: "PENDING_REVIEW",
      userId: "user-1",
    });

    await decideTraderApplicationAction(decisionForm());

    expect(tx.traderApplication.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "application-1", status: "PENDING_REVIEW" },
      }),
    );
    expect(tx.userRole.createMany).toHaveBeenCalledWith({
      data: [{ roleId: "role-client", userId: "user-1" }],
      skipDuplicates: true,
    });
    expect(tx.auditLog.create).toHaveBeenCalledTimes(1);
  });

  it("rolls back role and audit work when another admin wins the race", async () => {
    mocks.findApplication.mockResolvedValue({
      id: "application-1",
      status: "PENDING_REVIEW",
      userId: "user-1",
    });
    tx.traderApplication.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      decideTraderApplicationAction(decisionForm()),
    ).rejects.toThrow("Trader application changed during review");

    expect(tx.role.upsert).not.toHaveBeenCalled();
    expect(tx.userRole.createMany).not.toHaveBeenCalled();
    expect(tx.userRole.deleteMany).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it("rejects a second decision after the application is terminal", async () => {
    mocks.findApplication.mockResolvedValue({
      id: "application-1",
      status: "APPROVED",
      userId: "user-1",
    });

    await expect(
      decideTraderApplicationAction(decisionForm("REJECTED")),
    ).rejects.toThrow("already been decided");

    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
