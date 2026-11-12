import { z } from "zod";

export const emailSchema = z.string().email().max(255).toLowerCase();
export const reservedUsernames = new Set([
  "admin",
  "api",
  "app",
  "categories",
  "discover",
  "help",
  "how-it-works",
  "login",
  "logout",
  "notifications",
  "opportunities",
  "password-recovery",
  "preview",
  "privacy",
  "reset-password",
  "settings",
  "sign-in",
  "sign-up",
  "support",
  "terms",
  "trust-safety",
  "u",
]);
export const usernameSchema = z
  .string()
  .trim()
  .min(3)
  .max(30)
  .regex(
    /^[a-zA-Z0-9_-]+$/,
    "Username can only contain letters, numbers, underscores, and hyphens.",
  )
  .toLowerCase()
  .refine((value) => !reservedUsernames.has(value), {
    message: "This username is reserved.",
  });

export const passwordSchema = z
  .string()
  .min(10, "Password must be at least 10 characters.")
  .max(200)
  .regex(/[A-Za-z]/, "Password must include at least one letter.")
  .regex(/[0-9]/, "Password must include at least one number.");

/**
 * A display name is a human-readable name, not a username, email local-part,
 * or generated identifier. Keep this shared by signup, profile setup and edits.
 */
function looksLikeGeneratedName(value: string) {
  const normalized = value.trim().toLocaleLowerCase();
  const placeholderNames = new Set([
    "deleted member",
    "demo user",
    "new ptahx member",
    "ptahx member",
    "test user",
    "unknown user",
  ]);
  if (placeholderNames.has(normalized)) return true;

  const tokens = value.split(/[\\s'’.-]+/).filter(Boolean);
  if (
    tokens.length > 1 &&
    tokens.every((token) => token.toLocaleLowerCase() === tokens[0].toLocaleLowerCase())
  ) {
    return true;
  }

  const compact = value.replace(/[\\s'’.-]/g, "");
  if (compact.length < 12) return false;

  const uppercaseInside = [...compact.slice(1)].filter(
    (character) =>
      character !== character.toLocaleLowerCase() &&
      character === character.toLocaleUpperCase(),
  ).length;
  const vowelRatio = (compact.match(/[aeiouy]/gi) ?? []).length / compact.length;

  return uppercaseInside >= 2 || (compact.length >= 14 && vowelRatio < 0.2);
}

export const personNameSchema = z
  .string()
  .trim()
  .min(2, "Enter your name.")
  .max(120, "Name must be 120 characters or fewer.")
  .regex(
    /^[\p{L}\p{M}]+(?:[ '\u2019-][\p{L}\p{M}]+)*$/u,
    "Use letters, spaces, apostrophes or hyphens in your name.",
  )
  .refine((value) => !looksLikeGeneratedName(value), {
    message: "Enter a human-readable name, not an ID or random string.",
  });

export const signUpSchema = z
  .object({
    confirmPassword: z.string().min(1, "Confirm your password."),
    email: emailSchema,
    name: personNameSchema,
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
  showPresence: z.boolean().default(true),
  showLastActiveTime: z.boolean().default(false),
});

export const profileSetupSchema = profileSchema.extend({
  name: personNameSchema,
  username: usernameSchema,
});
