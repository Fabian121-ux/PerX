import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Write-path failure isolation for the trader application.
 *
 * P0-1 guarded the admin READ path. This is the user-facing WRITE path, which
 * had the same latent fault: `hasDatabaseUrl()` covers a missing environment
 * variable, but not a database that is present and cannot answer - a missing
 * relation, a pool timeout, a dropped connection. Both calls then threw
 * uncaught out of the server action, so the user got an unhandled error even
 * though the action is already shaped to return a usable typed error state.
 *
 * The subtle part is the APPROVED branch: `redirect()` works by throwing, and
 * it sits INSIDE the region being wrapped. A naive try/catch swallows it and an
 * already-approved user silently stays on the form.
 */

const mocks = vi.hoisted(() => ({
  findApplication: vi.fn(),
  hasDatabaseUrl: vi.fn(),
  requireCapabilityOrNotFound: vi.fn(),
  requireUser: vi.fn(),
  transaction: vi.fn(),
  upsertApplication: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
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

import { submitTraderApplicationAction } from "@/features/trader/actions";

const ANSWERS = {
  applicantKind: "INDIVIDUAL",
  experience:
    "I have several years of practical experience delivering software projects.",
  headline: "Software services and project delivery",
  tradeCategory: "software",
};

function applicationForm() {
  const formData = new FormData();
  for (const [key, value] of Object.entries(ANSWERS)) formData.set(key, value);
  return formData;
}

/** The shape thrown when the relation is absent, as in the P0-1 outage. */
function missingTableError() {
  return Object.assign(
    new Error(
      "The table `public.TraderApplication` does not exist in the current database.",
    ),
    { code: "P2021" },
  );
}

describe("trader application submit failure isolation", () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.hasDatabaseUrl.mockReturnValue(true);
    mocks.requireUser.mockResolvedValue({ id: "user-1" });
    mocks.findApplication.mockResolvedValue(null);
    mocks.upsertApplication.mockResolvedValue({ id: "application-1" });
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("returns a usable error state when the lookup rejects", async () => {
    mocks.findApplication.mockRejectedValue(missingTableError());

    const result = await submitTraderApplicationAction(
      { status: "idle" },
      applicationForm(),
    );

    expect(result.status).toBe("error");
    expect(result.message).toMatch(/could not be sent/i);
    // Mirrors the admin decision path: say what did NOT happen.
    expect(result.message).toMatch(/nothing was (changed|submitted|saved)/i);
    expect(mocks.upsertApplication).not.toHaveBeenCalled();
  });

  it("returns a usable error state when the write rejects", async () => {
    mocks.upsertApplication.mockRejectedValue(missingTableError());

    const result = await submitTraderApplicationAction(
      { status: "idle" },
      applicationForm(),
    );

    expect(result.status).toBe("error");
    expect(result.message).toMatch(/could not be sent/i);
  });

  it("does not throw out of the action on either failure", async () => {
    mocks.findApplication.mockRejectedValue(missingTableError());
    await expect(
      submitTraderApplicationAction({ status: "idle" }, applicationForm()),
    ).resolves.toBeDefined();

    mocks.findApplication.mockResolvedValue(null);
    mocks.upsertApplication.mockRejectedValue(missingTableError());
    await expect(
      submitTraderApplicationAction({ status: "idle" }, applicationForm()),
    ).resolves.toBeDefined();
  });

  it("asserts no cause it has not established", async () => {
    mocks.upsertApplication.mockRejectedValue(missingTableError());

    const result = await submitTraderApplicationAction(
      { status: "idle" },
      applicationForm(),
    );

    // A missing relation is not a connectivity fault.
    expect(result.message).not.toMatch(/connection/i);
    expect(result.message).not.toMatch(/offline/i);
    expect(result.message).not.toMatch(/internet/i);
  });

  it("never leaks the error message into the returned state", async () => {
    mocks.upsertApplication.mockRejectedValue(missingTableError());

    const result = await submitTraderApplicationAction(
      { status: "idle" },
      applicationForm(),
    );

    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("TraderApplication");
    expect(serialized).not.toContain("does not exist");
    expect(serialized).not.toContain("P2021");
  });

  it("logs only the redacted digest/kind/route/timestamp shape", async () => {
    mocks.upsertApplication.mockRejectedValue(missingTableError());

    await submitTraderApplicationAction({ status: "idle" }, applicationForm());

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const [, payload] = errorSpy.mock.calls[0] as [
      string,
      Record<string, unknown>,
    ];

    expect(Object.keys(payload).sort()).toEqual([
      "digest",
      "kind",
      "route",
      "timestamp",
    ]);
    expect(payload.route).toBe("/app/trader");
    expect(typeof payload.timestamp).toBe("string");

    const serialized = JSON.stringify(errorSpy.mock.calls);
    expect(serialized).not.toContain("TraderApplication");
    expect(serialized).not.toContain("does not exist");
    expect(serialized).not.toContain("P2021");
    expect(serialized).not.toMatch(/at \w+ \(/); // no stack frames
  });

  /**
   * THE TRAP. `redirect()` throws, and it lives inside the guarded region.
   * If the catch swallows it, an approved user silently stays on the form.
   */
  it("still redirects an already-approved applicant", async () => {
    mocks.findApplication.mockResolvedValue({ status: "APPROVED" });

    await expect(
      submitTraderApplicationAction({ status: "idle" }, applicationForm()),
    ).rejects.toMatchObject({
      digest: expect.stringContaining("NEXT_REDIRECT"),
    });

    expect(mocks.upsertApplication).not.toHaveBeenCalled();
  });

  it("carries the already-approved destination on the redirect", async () => {
    mocks.findApplication.mockResolvedValue({ status: "APPROVED" });

    const error = await submitTraderApplicationAction(
      { status: "idle" },
      applicationForm(),
    ).catch((thrown: unknown) => thrown);

    expect(String((error as { digest?: string }).digest)).toContain(
      "/app/trader?status=already-approved",
    );
  });

  it("still redirects on a successful submission", async () => {
    await expect(
      submitTraderApplicationAction({ status: "idle" }, applicationForm()),
    ).rejects.toMatchObject({
      digest: expect.stringContaining("NEXT_REDIRECT"),
    });

    expect(mocks.upsertApplication).toHaveBeenCalledTimes(1);
  });

  /*
   * The APPROVED redirect is deliberately hoisted OUT of the try block, so the
   * two tests above would pass even without `unstable_rethrow`. These two cover
   * what that structure alone cannot: a control-flow signal raised from INSIDE
   * the guarded region - an auth refresh redirecting, a guard in the data layer
   * calling notFound(). Without the rethrow the catch converts them into a form
   * message and the navigation never happens.
   */
  it("does not convert a redirect thrown inside the guarded lookup into a message", async () => {
    const { redirect } = await import("next/navigation");
    mocks.findApplication.mockImplementation(() => {
      redirect("/sign-in?next=/app/trader");
    });

    await expect(
      submitTraderApplicationAction({ status: "idle" }, applicationForm()),
    ).rejects.toMatchObject({
      digest: expect.stringContaining("NEXT_REDIRECT"),
    });
  });

  it("does not convert a notFound thrown inside the guarded write into a message", async () => {
    const { notFound } = await import("next/navigation");
    mocks.upsertApplication.mockImplementation(() => {
      notFound();
    });

    await expect(
      submitTraderApplicationAction({ status: "idle" }, applicationForm()),
    ).rejects.toMatchObject({
      digest: "NEXT_HTTP_ERROR_FALLBACK;404",
    });
  });

  it("keeps the SUSPENDED branch's own specific message", async () => {
    mocks.findApplication.mockResolvedValue({ status: "SUSPENDED" });

    const result = await submitTraderApplicationAction(
      { status: "idle" },
      applicationForm(),
    );

    // A legitimate business outcome, not a failure. Must not be replaced by
    // the generic guard message.
    expect(result.message).toMatch(/suspended/i);
    expect(result.message).toMatch(/contact support/i);
    expect(result.message).not.toMatch(/could not be sent/i);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("keeps the PENDING_REVIEW branch's own specific message", async () => {
    mocks.findApplication.mockResolvedValue({ status: "PENDING_REVIEW" });

    const result = await submitTraderApplicationAction(
      { status: "idle" },
      applicationForm(),
    );

    expect(result.message).toMatch(/already under review/i);
    expect(result.message).not.toMatch(/could not be sent/i);
    expect(mocks.upsertApplication).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("keeps the missing-DATABASE_URL branch unchanged", async () => {
    mocks.hasDatabaseUrl.mockReturnValue(false);

    const result = await submitTraderApplicationAction(
      { status: "idle" },
      applicationForm(),
    );

    expect(result).toEqual({
      message: "Applications are temporarily unavailable. Please try again.",
      status: "error",
    });
    expect(mocks.findApplication).not.toHaveBeenCalled();
  });

  it("keeps validation field errors and the 1-vs-many wording", async () => {
    const formData = new FormData();
    formData.set("applicantKind", "INDIVIDUAL");
    formData.set("experience", "too short");
    formData.set("headline", "short");
    formData.set("tradeCategory", "software");

    const result = await submitTraderApplicationAction(
      { status: "idle" },
      formData,
    );

    expect(result.status).toBe("error");
    expect(Object.keys(result.fieldErrors ?? {}).sort()).toEqual([
      "experience",
      "headline",
    ]);
    expect(result.message).toMatch(/2 answers need your attention/i);
    expect(mocks.findApplication).not.toHaveBeenCalled();
  });

  it("uses singular wording for exactly one invalid answer", async () => {
    const formData = applicationForm();
    formData.set("headline", "short");

    const result = await submitTraderApplicationAction(
      { status: "idle" },
      formData,
    );

    expect(result.message).toMatch(/1 answer needs your attention/i);
  });

  it("writes exactly the answers the applicant submitted", async () => {
    await submitTraderApplicationAction(
      { status: "idle" },
      applicationForm(),
    ).catch(() => undefined); // swallow the success redirect

    const args = mocks.upsertApplication.mock.calls[0]?.[0];
    expect(args.create).toEqual(
      expect.objectContaining({
        experience: ANSWERS.experience,
        headline: ANSWERS.headline,
        status: "PENDING_REVIEW",
        userId: "user-1",
      }),
    );
    // Re-submission must clear the previous reviewer note.
    expect(args.update.reviewerNote).toBeNull();
  });
});
