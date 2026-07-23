import { z } from "zod";

import {
  currencyValues,
  opportunityCategoryValues,
  opportunityTypeValues,
  reportReasonValues,
} from "@/lib/options";

export const opportunityFormSchema = z.object({
  title: z.string().trim().min(8).max(140),
  summary: z.string().trim().min(20).max(260),
  description: z.string().trim().min(80).max(4000),
  type: z.enum(opportunityTypeValues),
  category: z.enum(opportunityCategoryValues),
  location: z.string().trim().max(120).optional(),
  remote: z.boolean().default(true),
  currency: z.enum(currencyValues).default("NGN"),
  budgetMin: z.string().trim().optional(),
  budgetMax: z.string().trim().optional(),
  skills: z.string().trim().max(500).optional(),
  intent: z.enum(["draft", "publish"]).default("draft"),
});

export const opportunityReportSchema = z.object({
  opportunityId: z.string().cuid(),
  reason: z.enum(reportReasonValues),
  details: z.string().trim().max(1000).optional(),
});

export const proposalFormSchema = z.object({
  opportunityId: z.string().min(1),
  amount: z.string().trim().min(1),
  description: z.string().trim().min(40).max(2000),
  deliveryDays: z.coerce.number().int().min(1).max(365),
  revisions: z.coerce.number().int().min(0).max(12),
});
