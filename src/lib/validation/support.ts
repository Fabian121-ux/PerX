import { z } from "zod";

import { supportCategoryValues } from "@/lib/options";

export const supportTicketSchema = z.object({
  category: z.enum(supportCategoryValues),
  message: z.string().trim().min(20).max(4000),
  subject: z.string().trim().min(8).max(140),
});
