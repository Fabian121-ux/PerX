import { z } from "zod";

export const opportunityFormSchema = z.object({
  title: z.string().trim().min(8).max(140),
  summary: z.string().trim().min(20).max(260),
  description: z.string().trim().min(80).max(4000),
  type: z.enum(["JOB", "FREELANCE_PROJECT"]),
  category: z.string().trim().min(2).max(80),
  location: z.string().trim().max(120).optional(),
  remote: z.boolean().default(true),
  currency: z.string().trim().length(3).default("NGN"),
  budgetMin: z.string().trim().optional(),
  budgetMax: z.string().trim().optional(),
  skills: z.string().trim().max(500).optional(),
  intent: z.enum(["draft", "publish"]).default("draft"),
});

export const proposalFormSchema = z.object({
  opportunityId: z.string().min(1),
  amount: z.string().trim().min(1),
  description: z.string().trim().min(40).max(2000),
  deliveryDays: z.coerce.number().int().min(1).max(365),
  revisions: z.coerce.number().int().min(0).max(12),
});
