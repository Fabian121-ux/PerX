import { z } from "zod";

export const emailSchema = z.string().email().max(255).toLowerCase();
export const usernameSchema = z
  .string()
  .trim()
  .min(3)
  .max(30)
  .regex(
    /^[a-zA-Z0-9_-]+$/,
    "Username can only contain letters, numbers, underscores, and hyphens.",
  )
  .toLowerCase();

export const passwordSchema = z
  .string()
  .min(10, "Password must be at least 10 characters.")
  .max(200)
  .regex(/[A-Za-z]/, "Password must include at least one letter.")
  .regex(/[0-9]/, "Password must include at least one number.");

export const signUpSchema = z
  .object({
    confirmPassword: z.string().min(1, "Confirm your password."),
    email: emailSchema,
    name: z.string().trim().min(2).max(120),
    password: passwordSchema,
    termsAccepted: z.literal(true, {
      error: "You must accept the terms to create an account.",
    }),
    username: usernameSchema,
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(200),
});

export const profileSchema = z.object({
  headline: z.string().trim().min(6).max(160),
  biography: z.string().trim().min(30).max(1600),
  location: z.string().trim().min(2).max(120),
  profileImageUrl: z.string().trim().url().or(z.literal("")).optional(),
  skills: z.string().trim().max(400).optional(),
  websiteUrl: z.string().trim().url().or(z.literal("")).optional(),
  isDiscoverable: z.boolean().default(true),
  showLocation: z.boolean().default(true),
  showSkills: z.boolean().default(true),
  allowConnectionRequests: z.boolean().default(true),
  allowMessagesFromConnections: z.boolean().default(true),
  allowMessagesFromMembers: z.boolean().default(false),
});

export const profileSetupSchema = profileSchema.extend({
  name: z.string().trim().min(2).max(120),
  username: usernameSchema,
});
