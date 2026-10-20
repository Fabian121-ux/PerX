import { describe, expect, it } from "vitest";
import { formatDealStage, getDealNextAction, getDealRoomProgress } from "@/lib/deals/room-progress";

const work = [
  { id: "m1", title: "Prepare", status: "APPROVED" },
  { id: "m2", title: "Send", status: "IN_PROGRESS" },
  { id: "m3", title: "Confirm", status: "SUBMITTED" },
];

describe("Deal room status presentation", () => {
  it("measures milestone approvals rather than counting payments as progress", () => {
    expect(getDealRoomProgress(work)).toEqual({
      awaitingReview: 1, completed: 1, percent: 33, total: 3,
    });
    expect(getDealRoomProgress([])).toEqual({ awaitingReview: 0, completed: 0, percent: 0, total: 0 });
    expect(getDealRoomProgress([{ id: "m", title: "Done", status: "RELEASED" }]).percent).toBe(100);
  });
  it("shows only role-authorized next actions in correct Deal state", () => {
    expect(getDealNextAction("IN_PROGRESS", "seller", work)).toBe("submit");
    expect(getDealNextAction("IN_PROGRESS", "provider", work)).toBe("submit");
    expect(getDealNextAction("SUBMITTED", "buyer", work)).toBe("review");
    expect(getDealNextAction("SUBMITTED", "client", work)).toBe("review");
    expect(getDealNextAction("SUBMITTED", "seller", work)).toBeNull();
    expect(getDealNextAction("IN_PROGRESS", "buyer", work)).toBeNull();
    expect(getDealNextAction("RELEASED", "provider", work)).toBeNull();
    expect(getDealNextAction("IN_PROGRESS", "provider", [])).toBeNull();
  });
  it("formats statuses without confusing them with a real payment ledger", () => {
    expect(formatDealStage("AWAITING_FUNDING")).toBe("Awaiting Funding");
    expect(formatDealStage("IN_PROGRESS")).toBe("In Progress");
  });
});
