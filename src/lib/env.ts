import { z } from "zod";

const booleanEnv = z
  .enum(["true", "false"])
  .default("false")
  .transform((value) => value === "true");

const optionalPositiveIntegerEnv = z.preprocess(
  (value) => (value === "" || value === undefined ? undefined : value),
  z.coerce.number().int().positive().optional(),
);

const signupEnvSchema = z.object({
  PERX_BETA_MAX_USERS: optionalPositiveIntegerEnv,
  PERX_SIGNUP_MODE: z.enum(["closed", "open_beta", "public"]).default("closed"),
});

const envSchema = z.object({
  DATABASE_URL: z.string().url().optional(),
  DIRECT_URL: z.string().url().optional(),
  PERX_DATA_MODE: z.enum(["mock", "database", "auto"]).optional(),
  ...signupEnvSchema.shape,
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1).optional(),
  SESSION_COOKIE_NAME: z.string().min(1).default("perx_session"),
  AUTH_SESSION_DAYS: z.coerce.number().int().min(1).max(120).default(30),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  UPLOAD_MAX_BYTES: z.coerce
    .number()
    .int()
    .min(1)
    .max(25 * 1024 * 1024)
    .default(5 * 1024 * 1024),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  ERROR_MONITORING_DSN: z.string().url().or(z.literal("")).optional(),
  PERX_ENABLE_PREVIEW: booleanEnv,
});

const databaseRequiredVariables = [
  "DATABASE_URL",
  "DIRECT_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
] as const;

const strictRequiredVariables = [
  "PERX_DATA_MODE",
  "NEXT_PUBLIC_APP_URL",
  "SESSION_COOKIE_NAME",
  "AUTH_SESSION_DAYS",
  "UPLOAD_MAX_BYTES",
  "LOG_LEVEL",
  "PERX_ENABLE_PREVIEW",
] as const;

type RawServerEnv = z.infer<typeof envSchema>;

export type SignupMode = z.infer<typeof signupEnvSchema>["PERX_SIGNUP_MODE"];

export type SignupConfig =
  | {
      maximumUsers: number;
      mode: "open_beta";
    }
  | {
      maximumUsers: null;
      mode: "closed" | "public";
    };

export type ServerEnv = Omit<
  RawServerEnv,
  "NEXT_PUBLIC_APP_URL" | "ERROR_MONITORING_DSN"
> & {
  ERROR_MONITORING_DSN?: string;
  NEXT_PUBLIC_APP_URL: string;
};

function isStrictDeploymentEnvironment(env: NodeJS.ProcessEnv) {
  return (
    env.VERCEL_ENV === "production" ||
    env.VERCEL_ENV === "preview" ||
    env.PERX_DEPLOY_ENV === "production" ||
    env.PERX_DEPLOY_ENV === "staging"
  );
}

function isProductionRuntime(env: NodeJS.ProcessEnv) {
  return (
    env.NODE_ENV === "production" ||
    env.VERCEL_ENV === "production" ||
    env.PERX_DEPLOY_ENV === "production"
  );
}

function isLocalAppUrl(value: string) {
  try {
    const url = new URL(value);
    return ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  } catch {
    return false;
  }
}

function assertPresent(
  env: RawServerEnv,
  variables: readonly (keyof RawServerEnv)[],
) {
  const missing = variables.filter((name) => {
    const value = env[name];
    return value === undefined || value === "";
  });

  if (missing.length) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(", ")}.`,
    );
  }
}

function assertValidSignupConfig(env: z.infer<typeof signupEnvSchema>) {
  if (env.PERX_SIGNUP_MODE === "open_beta" && !env.PERX_BETA_MAX_USERS) {
    throw new Error(
      "PERX_SIGNUP_MODE=open_beta requires PERX_BETA_MAX_USERS to be a positive integer.",
    );
  }
}

export function getSignupConfig(): SignupConfig {
  const parsed = signupEnvSchema.parse(process.env);
  assertValidSignupConfig(parsed);

  if (parsed.PERX_SIGNUP_MODE === "open_beta") {
    return {
      maximumUsers: parsed.PERX_BETA_MAX_USERS!,
      mode: "open_beta",
    };
  }

  return {
    maximumUsers: null,
    mode: parsed.PERX_SIGNUP_MODE,
  };
}

export function getServerEnv(): ServerEnv {
  const parsed = envSchema.parse(process.env);
  const strict = isStrictDeploymentEnvironment(process.env);
  assertValidSignupConfig(parsed);

  if (isProductionRuntime(process.env) && parsed.PERX_DATA_MODE === "mock") {
    throw new Error(
      "PERX_DATA_MODE=mock is strictly prohibited in production.",
    );
  }

  if (strict) {
    assertPresent(parsed, strictRequiredVariables);
  }

  if (
    parsed.PERX_DATA_MODE === "database" ||
    (strict && parsed.PERX_DATA_MODE !== "mock")
  ) {
    assertPresent(parsed, databaseRequiredVariables);
  }

  const appUrl = parsed.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  if (strict && isLocalAppUrl(appUrl)) {
    throw new Error(
      "NEXT_PUBLIC_APP_URL must not point to localhost in staging or production.",
    );
  }

  const monitoringDsn = parsed.ERROR_MONITORING_DSN || undefined;

  return {
    ...parsed,
    ERROR_MONITORING_DSN: monitoringDsn,
    NEXT_PUBLIC_APP_URL: appUrl,
  };
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
      throw new Error(
        "PERX_DATA_MODE=mock is strictly prohibited in production.",
      );
    }
    mode = "database";
  } else if (!mode || mode === "auto") {
    mode = env.DATABASE_URL ? "database" : "mock";
  }

  if (mode === "database") {
    assertDatabaseConfiguration();
    cachedDataMode = "database";
    return cachedDataMode;
  }

  console.warn(
    "WARNING: Running in mock mode. No database connection will be used.",
  );
  cachedDataMode = "mock";
  return cachedDataMode;
}

export function assertDatabaseConfiguration() {
  const env = getServerEnv();
  assertPresent(env, databaseRequiredVariables);
}

export function isProductionMockModeError(error: unknown) {
  return (
    error instanceof Error &&
    error.message.includes("PERX_DATA_MODE=mock is strictly prohibited")
  );
}

export function setCachedDataModeForTest(
  mode: "mock" | "database" | undefined,
) {
  cachedDataMode = mode;
}
