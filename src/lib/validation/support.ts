import { z } from "zod";

import { supportCategoryValues } from "@/lib/options";

export const supportTicketSchema = z.object({
  category: z.enum(supportCategoryValues, {
    error: "Choose a support category.",
  }),
  message: z
    .string()
    .trim()
    .min(20, "Describe the issue in at least 20 characters.")
    .max(4000, "Keep the description under 4,000 characters."),
  subject: z
    .string()
    .trim()
    .min(8, "Summarize the issue in at least 8 characters.")
    .max(140, "Keep the subject under 140 characters."),
});
