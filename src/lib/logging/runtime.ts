type RuntimeLogInput = {
  error: unknown;
  operation: string;
  route: string;
};

function sanitizeMessage(message: string) {
  return message
    .replace(/postgres(?:ql)?:\/\/[^\s"'`]+/gi, "[redacted-database-url]")
    .replace(/https?:\/\/[^@\s"'`]+:[^@\s"'`]+@[^\s"'`]+/gi, "[redacted-url]")
    .slice(0, 500);
}

export function logServerDataError({ error, operation, route }: RuntimeLogInput) {
  const err = error as
    | (Error & {
        clientVersion?: string;
        code?: string;
        digest?: string;
        meta?: unknown;
      })
    | undefined;

  console.error("[perx:server-data-error]", {
    digest: err?.digest,
    errorType: err?.name ?? typeof error,
    message: err?.message
      ? sanitizeMessage(err.message)
      : "Unknown server data error",
    operation,
    prismaCode: err?.code,
    requestEnvironment: {
      dataMode: process.env.PERX_DATA_MODE ? "set" : "missing",
      databaseUrl: process.env.DATABASE_URL ? "set" : "missing",
      directUrl: process.env.DIRECT_URL ? "set" : "missing",
      nodeEnv: process.env.NODE_ENV ?? "unset",
      previewEnabled: process.env.PERX_ENABLE_PREVIEW === "true",
      vercelEnv: process.env.VERCEL_ENV ?? "unset",
    },
    route,
  });
}
