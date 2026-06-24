import { previewConversations, previewDeals, previewOpportunities, previewProposals } from "./preview";

export function getTestMyOpportunities() {
  return previewOpportunities;
}

export function getTestDashboardMetrics() {
  return {
    deals: previewDeals.length,
    notifications: 2,
    opportunities: previewOpportunities.length,
    proposals: previewProposals.length,
  };
}

export function getTestUserProposals() {
  return previewProposals;
}

export function getTestUserDeals() {
  return previewDeals;
}

export function getTestDealForUser(dealId: string) {
  return previewDeals.find((d) => d.id === dealId) || null;
}

export function getTestConversations() {
  return previewConversations;
}
