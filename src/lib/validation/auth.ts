import { z } from "zod";

export const emailSchema = z.string().email().max(255).toLowerCase();

export const signUpSchema = z.object({
  email: emailSchema,
  name: z.string().trim().min(2).max(120),
  password: z.string().min(10).max(200),
  roles: z.array(z.enum(["FREELANCER", "CLIENT", "FOUNDER", "INVESTOR", "PROPERTY_OWNER"])).min(1),
});

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(200),
});

export const profileSchema = z.object({
  headline: z.string().trim().min(6).max(160),
  biography: z.string().trim().min(30).max(1600),
  location: z.string().trim().min(2).max(120),
  skills: z.string().trim().max(400).optional(),
});

export const profileSetupSchema = profileSchema.extend({
  name: z.string().trim().min(2).max(120),
  username: z
    .string()
    .trim()
    .min(3)
    .max(30)
    .regex(/^[a-zA-Z0-9_-]+$/, "Username can only contain letters, numbers, underscores, and hyphens.")
    .toLowerCase(),
});

