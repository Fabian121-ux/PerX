/**
 * Read-only agreement progress presentation. Never infer real payment state
 * from a simulated escrow/milestone status.
 */
export type DealMilestoneProgress = {
  id: string;
  status: string;
  title: string;
};

const FINISHED = new Set(["APPROVED", "COMPLETED", "RELEASED"]);
const NEEDS_REVIEW = new Set(["SUBMITTED", "IN_REVIEW", "AWAITING_APPROVAL"]);

export function getDealRoomProgress(milestones: readonly DealMilestoneProgress[]) {
  const total = milestones.length;
  const completed = milestones.filter((milestone) => FINISHED.has(milestone.status)).length;
  const awaitingReview = milestones.filter((milestone) => NEEDS_REVIEW.has(milestone.status)).length;
  return {
    awaitingReview,
    completed,
    percent: total === 0 ? 0 : Math.round((completed / total) * 100),
    total,
  };
}

export function formatDealStage(stage: string) {
  return stage.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function getDealNextAction(
  dealStatus: string,
  participantRole: string | undefined,
  milestones: readonly DealMilestoneProgress[],
): "submit" | "review" | null {
  const role = participantRole?.toLowerCase();
  if (dealStatus === "IN_PROGRESS" &&
    ["provider", "freelancer", "seller"].includes(role ?? "") &&
    milestones.some((milestone) => milestone.status === "IN_PROGRESS")) {
    return "submit";
  }
  if (dealStatus === "SUBMITTED" &&
    ["client", "buyer"].includes(role ?? "") &&
    milestones.some((milestone) => milestone.status === "SUBMITTED")) {
    return "review";
  }
  return null;
}
