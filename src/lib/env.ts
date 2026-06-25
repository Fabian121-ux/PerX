import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url().optional(),
  SESSION_COOKIE_NAME: z.string().min(1).default("perx_session"),
  AUTH_SESSION_DAYS: z.coerce.number().int().min(1).max(120).default(30),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  UPLOAD_MAX_BYTES: z.coerce.number().int().min(1).max(25 * 1024 * 1024).default(5 * 1024 * 1024),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  ERROR_MONITORING_DSN: z.string().optional(),
});

export type ServerEnv = z.infer<typeof envSchema>;

export function getServerEnv(): ServerEnv {
  return envSchema.parse(process.env);
}

export function hasDatabaseUrl() {
  return Boolean(process.env.DATABASE_URL);
}
