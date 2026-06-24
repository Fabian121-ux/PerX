export type EscrowState =
  | "DRAFT"
  | "AWAITING_FUNDING"
  | "FUNDED"
  | "IN_PROGRESS"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "RELEASED"
  | "CANCELLED"
  | "REFUND_PENDING"
  | "REFUNDED"
  | "DISPUTED"
  | "RESOLVED";

export type EscrowEvent =
  | "create"
  | "fund"
  | "start"
  | "submit"
  | "review"
  | "approve"
  | "release"
  | "cancel"
  | "request_refund"
  | "refund"
  | "dispute"
  | "resolve";

const transitions: Record<EscrowState, Partial<Record<EscrowEvent, EscrowState>>> = {
  APPROVED: { dispute: "DISPUTED", release: "RELEASED" },
  AWAITING_FUNDING: { cancel: "CANCELLED", fund: "FUNDED" },
  CANCELLED: {},
  DISPUTED: { resolve: "RESOLVED" },
  DRAFT: { cancel: "CANCELLED", create: "AWAITING_FUNDING" },
  FUNDED: { cancel: "REFUND_PENDING", dispute: "DISPUTED", start: "IN_PROGRESS" },
  IN_PROGRESS: { dispute: "DISPUTED", submit: "SUBMITTED" },
  REFUND_PENDING: { dispute: "DISPUTED", refund: "REFUNDED" },
  REFUNDED: {},
  RELEASED: {},
  RESOLVED: { refund: "REFUNDED", release: "RELEASED" },
  SUBMITTED: { dispute: "DISPUTED", review: "UNDER_REVIEW" },
  UNDER_REVIEW: { approve: "APPROVED", dispute: "DISPUTED", request_refund: "REFUND_PENDING" },
};

export function getNextEscrowState(current: EscrowState, event: EscrowEvent) {
  return transitions[current][event] ?? null;
}

export function assertEscrowTransition(current: EscrowState, event: EscrowEvent) {
  const next = getNextEscrowState(current, event);
  if (!next) {
    throw new Error(`Cannot apply escrow event ${event} from ${current}.`);
  }
  return next;
}
