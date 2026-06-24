import { describe, expect, it } from "vitest";

import { assertEscrowTransition, getNextEscrowState } from "@/features/escrow/state-machine";

describe("escrow state machine", () => {
  it("moves through the primary release path", () => {
    expect(getNextEscrowState("AWAITING_FUNDING", "fund")).toBe("FUNDED");
    expect(getNextEscrowState("FUNDED", "start")).toBe("IN_PROGRESS");
    expect(getNextEscrowState("IN_PROGRESS", "submit")).toBe("SUBMITTED");
    expect(getNextEscrowState("SUBMITTED", "review")).toBe("UNDER_REVIEW");
    expect(getNextEscrowState("UNDER_REVIEW", "approve")).toBe("APPROVED");
    expect(getNextEscrowState("APPROVED", "release")).toBe("RELEASED");
  });

  it("rejects invalid transitions", () => {
    expect(() => assertEscrowTransition("RELEASED", "fund")).toThrow();
  });
});
