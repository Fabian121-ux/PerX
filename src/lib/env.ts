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

  if (!mode) {
    if (isProd) {
      mode = "database";
    } else {
      mode = env.DATABASE_URL ? "auto" : "mock";
    }
  }

  if (mode === "database") {
    cachedDataMode = "database";
    return cachedDataMode;
  }

  if (mode === "mock") {
    if (isProd) {
      console.warn("WARNING: Running production in mock mode. This should only be used for static builds or preview deployments.");
    }
    cachedDataMode = "mock";
    return cachedDataMode;
  }

  // mode === "auto"
  if (isProd) {
    cachedDataMode = "database";
  } else {
    if (env.DATABASE_URL) {
      cachedDataMode = "database";
    } else {
      console.warn("PerX database is unavailable. Development mock data is active.");
      cachedDataMode = "mock";
    }
  }

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
