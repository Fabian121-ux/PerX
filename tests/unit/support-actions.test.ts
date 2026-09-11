import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  redirect: vi.fn(),
  requireUser: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/auth/session", () => ({ requireUser: mocks.requireUser }));
vi.mock("@/lib/db/prisma", () => ({
  getPrisma: () => ({ supportTicket: { create: mocks.create } }),
}));
vi.mock("@/lib/logging/audit", () => ({ writeAuditLog: vi.fn() }));

import { createSupportTicketAction } from "@/features/support/actions";

function form(
  values: Partial<Record<"category" | "message" | "subject", string>> = {},
) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

describe("createSupportTicketAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ id: "user-1" });
  });

  it("returns correctable field errors without writing invalid requests", async () => {
    const result = await createSupportTicketAction(
      { status: "idle" },
      form({ category: "", message: "Too short", subject: "Short" }),
    );

    expect(result.status).toBe("error");
    expect(result.fieldErrors).toEqual(
      expect.objectContaining({
        category: expect.any(String),
        message: expect.any(String),
        subject: expect.any(String),
      }),
    );
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("returns a retryable error when persistence fails", async () => {
    mocks.create.mockRejectedValue(new Error("database unavailable"));
    const result = await createSupportTicketAction(
      { status: "idle" },
      form({
        category: "ACCOUNT",
        message: "I cannot access my account and need assistance.",
        subject: "Account access problem",
      }),
    );

    expect(result).toEqual(
      expect.objectContaining({
        status: "error",
        message: expect.stringMatching(/not sent/i),
      }),
    );
  });

  it("persists the ticket and initial message together before acknowledging success", async () => {
    mocks.create.mockResolvedValue({ id: "ticket-1" });

    await createSupportTicketAction(
      { status: "idle" },
      form({
        category: "ACCOUNT",
        message: "I cannot access my account and need assistance.",
        subject: "Account access problem",
      }),
    );

    expect(mocks.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        authorId: "user-1",
        messages: {
          create: {
            body: "I cannot access my account and need assistance.",
            senderId: "user-1",
          },
        },
      }),
      select: { id: true },
    });
    expect(mocks.redirect).toHaveBeenCalledWith(
      "/app/service-center?created=ticket-1",
    );
  });
});
