import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url().optional(),
  PERX_DATA_MODE: z.enum(["mock", "database", "auto"]).optional(),
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

let cachedDataMode: "mock" | "database" | undefined;

export function getResolvedDataMode(): "mock" | "database" {
  if (cachedDataMode) return cachedDataMode;

  const env = getServerEnv();
  const isProd = process.env.NODE_ENV === "production";
  
  let mode = env.PERX_DATA_MODE;

  if (isProd) {
    if (mode === "mock") {
      throw new Error("PERX_DATA_MODE=mock is strictly prohibited in production.");
    }
    mode = "database";
  } else if (!mode || mode === "auto") {
    mode = env.DATABASE_URL ? "database" : "mock";
  }

  if (mode === "database") {
    if (!env.DATABASE_URL) {
      throw new Error("DATABASE_URL is required in database mode.");
    }
    cachedDataMode = "database";
    return cachedDataMode;
  }

  console.warn("WARNING: Running in mock mode. No database connection will be used.");
  cachedDataMode = "mock";
  return cachedDataMode;
}

export function assertDatabaseConfiguration() {
  const env = getServerEnv();
  if (!env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required in database mode.");
  }
}

export function setCachedDataModeForTest(mode: "mock" | "database" | undefined) {
  cachedDataMode = mode;
}
