import { describe, expect, it } from "vitest";

import {
  describesSimulatedReleaseOnly,
  getDeliveryApprovalDecision,
} from "@/features/deals/authorization";
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

describe("deal delivery approval authorization", () => {
  const baseDeal = {
    participants: [
      { role: "client", userId: "client-user" },
      { role: "freelancer", userId: "freelancer-user" },
    ],
    releases: [],
    status: "SUBMITTED",
  };

  it("allows the client to approve an eligible submitted delivery", () => {
    expect(getDeliveryApprovalDecision(baseDeal, "client-user")).toEqual({
      allowed: true,
    });
  });

  it("prevents the freelancer from approving their own delivery", () => {
    expect(getDeliveryApprovalDecision(baseDeal, "freelancer-user")).toEqual({
      allowed: false,
      reason: "not-client",
    });
  });

  it("prevents unrelated users from approving a deal", () => {
    expect(getDeliveryApprovalDecision(baseDeal, "other-user")).toEqual({
      allowed: false,
      reason: "not-participant",
    });
  });

  it("rejects invalid status transitions", () => {
    expect(
      getDeliveryApprovalDecision({ ...baseDeal, status: "IN_PROGRESS" }, "client-user"),
    ).toEqual({
      allowed: false,
      reason: "invalid-status",
    });
  });

  it("rejects duplicate approvals after a release record exists", () => {
    expect(
      getDeliveryApprovalDecision(
        { ...baseDeal, releases: [{ id: "release-1" }] },
        "client-user",
      ),
    ).toEqual({
      allowed: false,
      reason: "already-released",
    });
  });

  it("requires simulated release wording to deny real payment custody", () => {
    expect(
      describesSimulatedReleaseOnly(
        "Simulated release state only. No real funds are collected, held, transferred, or released by perX.",
      ),
    ).toBe(true);
  });
});
