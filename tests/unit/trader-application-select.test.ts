import { describe, expect, it, vi } from "vitest";

/**
 * P0-7 A, root cause cover.
 *
 * `experience` is stored on TraderApplication but was never SELECTED, which is
 * why the page passed `experience: undefined` into the form defaults - the data
 * genuinely was not there. Fixing the page without fixing the query would have
 * been cosmetic.
 *
 * This asserts the query itself. A mutation that removes `experience: true`
 * from the select survives every test that mocks `getOwnTraderApplication`,
 * because those tests never reach the query at all.
 */

const mocks = vi.hoisted(() => ({ findUnique: vi.fn() }));

vi.mock("@/lib/db/prisma", () => ({
  getPrisma: () => ({ traderApplication: { findUnique: mocks.findUnique } }),
}));

import { getOwnTraderApplication } from "@/lib/trader/access";

describe("getOwnTraderApplication selects what the view promises", () => {
  it("selects experience, so a failed submit can re-render it", async () => {
    mocks.findUnique.mockResolvedValue(null);

    await getOwnTraderApplication("user-1");

    const select = mocks.findUnique.mock.calls[0]?.[0]?.select;
    expect(select?.experience).toBe(true);
  });

  it("selects every field the form re-renders from", async () => {
    mocks.findUnique.mockResolvedValue(null);

    await getOwnTraderApplication("user-1");

    const select = mocks.findUnique.mock.calls[0]?.[0]?.select;
    // The three fields the trader page feeds back into form defaults.
    for (const field of ["experience", "headline", "tradeCategory"]) {
      expect(select?.[field]).toBe(true);
    }
  });

  it("scopes the lookup to the requesting user", async () => {
    mocks.findUnique.mockResolvedValue(null);

    await getOwnTraderApplication("user-1");

    expect(mocks.findUnique.mock.calls[0]?.[0]?.where).toEqual({
      userId: "user-1",
    });
  });
});
