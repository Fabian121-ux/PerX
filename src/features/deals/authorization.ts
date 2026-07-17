export type DealParticipantSnapshot = {
  role: string;
  userId: string;
};

export type DealApprovalSnapshot = {
  participants: DealParticipantSnapshot[];
  releases?: { id: string }[];
  status: string;
};

export type DealApprovalDenialReason =
  | "not-participant"
  | "not-client"
  | "invalid-status"
  | "already-released";

export type DealApprovalDecision =
  | { allowed: true }
  | { allowed: false; reason: DealApprovalDenialReason };

function participantRole(role: string) {
  return role.trim().toLowerCase();
}

export function getDeliveryApprovalDecision(
  deal: DealApprovalSnapshot,
  userId: string,
): DealApprovalDecision {
  const currentParticipant = deal.participants.find(
    (participant) => participant.userId === userId,
  );

  if (!currentParticipant) {
    return { allowed: false, reason: "not-participant" };
  }

  const clientParticipant = deal.participants.find((participant) =>
    ["buyer", "client"].includes(participantRole(participant.role)),
  );

  if (clientParticipant?.userId !== userId) {
    return { allowed: false, reason: "not-client" };
  }

  if (deal.releases?.length) {
    return { allowed: false, reason: "already-released" };
  }

  if (deal.status !== "SUBMITTED") {
    return { allowed: false, reason: "invalid-status" };
  }

  return { allowed: true };
}

export function describesSimulatedReleaseOnly(note: string) {
  const normalized = note.toLowerCase();
  return (
    normalized.includes("simulated") &&
    normalized.includes("no real funds") &&
    !normalized.includes("real funds released")
  );
}
