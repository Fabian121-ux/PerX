/* eslint-disable @typescript-eslint/no-explicit-any */
import { PerXDataProvider } from "./interfaces";
import { 
  previewOpportunities, 
  previewDeals, 
  previewProposals, 
  previewConversations,
  previewUser,
  previewReviews
} from "../preview";
import { demoCategories, demoOpportunities, demoProfiles } from "../demo";

// Process-local, non-persistent store for mock writes
let opportunitiesStore = [...previewOpportunities];
let dealsStore = [...previewDeals];
let proposalsStore = [...previewProposals];
let conversationsStore = [...previewConversations];

export const mockProvider: PerXDataProvider = {
  opportunities: {
    getOpportunityFeed: async ({ category, q, type } = {}) => {
      // In mock mode, we try to use previewOpportunities or demoOpportunities
      let base = [...opportunitiesStore];
      if (base.length === 0) {
        // Fallback to demoOpportunities structure if preview ones are somehow empty
        base = demoOpportunities as any;
      }
      
      return base.filter((opp: any) => {
        const matchesCategory = !category || opp.category.slug === category;
        const matchesType = !type || opp.type === type;
        const matchesQuery = !q || `${opp.title} ${opp.summary}`.toLowerCase().includes(q.toLowerCase());
        return matchesCategory && matchesType && matchesQuery;
      });
    },
    getOpportunityBySlug: async (slug: string) => {
      return opportunitiesStore.find((opp) => opp.slug === slug) || 
             demoOpportunities.find((opp) => opp.slug === slug) || null;
    },
    getCategories: async () => {
      return demoCategories;
    },
    getMyOpportunities: async (userId: string) => {
      return opportunitiesStore.filter((opp: any) => opp.owner.username === userId || opp.ownerId === userId);
    },
  },
  app: {
    getDashboardMetrics: async () => {
      return {
        deals: dealsStore.length,
        notifications: 3,
        opportunities: opportunitiesStore.length,
        proposals: proposalsStore.length,
      };
    },
    getUserProposals: async (userId: string, direction: "sent" | "received") => {
      return proposalsStore.filter((p: any) => 
        direction === "sent" ? p.sender.username === userId || p.senderId === userId : p.opportunity?.owner?.username === userId
      );
    },
    getUserDeals: async (userId: string) => {
      return dealsStore.filter((d: any) => 
        d.participants?.some((p: any) => p.username === userId || p.id === userId)
      );
    },
    getDealForUser: async (dealId: string, userId: string) => {
      return dealsStore.find((d: any) => 
        d.id === dealId && d.participants?.some((p: any) => p.username === userId || p.id === userId)
      ) || null;
    },
    getConversations: async () => {
      return conversationsStore;
    },
    getConversationMessages: async (conversationId: string) => {
      const conv = conversationsStore.find(c => c.id === conversationId);
      return conv?.messages || [];
    },
  },
  profiles: {
    getPublicProfile: async (username: string) => {
      if (username === previewUser.username) {
        return {
          ...previewUser,
          profile: {
            skills: previewUser.skills.map((s, i) => ({ id: String(i), name: s })),
          },
          roles: previewUser.roles.map((r) => ({ role: { name: r } })),
          reviewsReceived: previewReviews,
        };
      }
      return demoProfiles.find((p) => p.username === username) || null;
    },
  },
  admin: {
    getAdminMetrics: async () => {
      return { auditLogs: 42, disputes: 1, opportunities: opportunitiesStore.length, reports: 0, reviews: previewReviews.length, users: 5, verification: 2 };
    },
    getAdminList: async (kind) => {
      switch (kind) {
        case "users": return [previewUser];
        case "profiles": return demoProfiles;
        case "opportunities": return opportunitiesStore;
        case "reports": return [];
        case "reviews": return previewReviews;
        case "disputes": return [];
        case "verification": return [];
        case "audit": return [];
      }
    },
  },
};

export function resetMockStore() {
  opportunitiesStore = [...previewOpportunities];
  dealsStore = [...previewDeals];
  proposalsStore = [...previewProposals];
  conversationsStore = [...previewConversations];
}
