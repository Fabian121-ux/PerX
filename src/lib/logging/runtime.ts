import { createHash } from "node:crypto";
import { headers } from "next/headers";

type RuntimeLogInput = {
  error: unknown;
  operation: string;
  recordId?: string;
  requestId?: string | null;
  route: string;
};

function sanitizeMessage(message: string) {
  return message
    .replace(/postgres(?:ql)?:\/\/[^\s"'`]+/gi, "[redacted-database-url]")
    .replace(/https?:\/\/[^@\s"'`]+:[^@\s"'`]+@[^\s"'`]+/gi, "[redacted-url]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]")
    .slice(0, 500);
}

function recordReference(recordId?: string) {
  if (!recordId) return undefined;
  return createHash("sha256").update(recordId).digest("hex").slice(0, 12);
}

function safeRequestId(requestId?: string | null) {
  return requestId?.replace(/[^A-Za-z0-9:._-]/g, "").slice(0, 100) || undefined;
}

function safeStackFrames(stack?: string) {
  return stack
    ?.split("\n")
    .slice(1)
    .filter((frame) => /^\s*at\s/.test(frame))
    .map((frame) => sanitizeMessage(frame.trim()))
    .slice(0, 6);
}

function safeErrorMessage(err?: Error & { code?: string }) {
  if (err?.code === "P2021" || err?.code === "P2022") {
    return (
      err.message
        .split("\n")
        .map((line) => line.trim())
        .find((line) => /^The (?:table|column) `[^`]+` does not exist/.test(line)) ??
      `Required database schema object is unavailable (${err.code}).`
    );
  }
  return "Server data operation failed.";
}

export async function getRequestCorrelationId() {
  try {
    const requestHeaders = await headers();
    return (
      requestHeaders.get("x-vercel-id") ??
      requestHeaders.get("x-request-id") ??
      requestHeaders.get("x-correlation-id")
    );
  } catch {
    return null;
  }
}

export function logServerDataError({
  error,
  operation,
  recordId,
  requestId,
  route,
}: RuntimeLogInput) {
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
    message: safeErrorMessage(err),
    operation,
    prismaCode: err?.code,
    recordRef: recordReference(recordId),
    requestEnvironment: {
      dataMode: process.env.PERX_DATA_MODE ? "set" : "missing",
      databaseUrl: process.env.DATABASE_URL ? "set" : "missing",
      deploymentCommit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12),
      directUrl: process.env.DIRECT_URL ? "set" : "missing",
      nodeEnv: process.env.NODE_ENV ?? "unset",
      previewEnabled: process.env.PERX_ENABLE_PREVIEW === "true",
      vercelEnv: process.env.VERCEL_ENV ?? "unset",
    },
    requestId: safeRequestId(requestId),
    route,
    stackFrames: safeStackFrames(err?.stack),
  });
}
