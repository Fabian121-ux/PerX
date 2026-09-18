import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * EMAIL-1: the password-reset orchestrator and the delivery predicate.
 *
 * Two bugs are pinned here.
 *
 * 1. `isPasswordResetDeliveryConfigured()` returned `NODE_ENV !== "production"`,
 *    i.e. it reported the development MODE rather than delivery CAPABILITY. The
 *    recovery page told developers "a reset link is on its way" when the link
 *    had only reached a server console, and would keep telling production that
 *    delivery was disabled even after a provider was configured.
 *
 * 2. `buildPasswordResetUrl` was documented as falling back to a relative path.
 *    It does not - `getServerEnv()` defaults NEXT_PUBLIC_APP_URL to
 *    http://localhost:3000, so the real failure is quieter and worse: a
 *    production email carrying a localhost link. Both are asserted below.
 */

const SENTINEL_KEY = "NOT-A-REAL-KEY-sentinel-value-for-tests-only";
const SENTINEL_FROM = "PtahX <sentinel-from@example.invalid>";
const SENTINEL_TO = "sentinel-recipient@example.invalid";
const SENTINEL_TOKEN = "SENTINEL_TOKEN_VALUE";

const fetchMock = vi.fn();
const savedEnv = { ...process.env };

function configure({
  appUrl,
  from,
  key,
  nodeEnv,
}: {
  appUrl?: string;
  from?: string;
  key?: string;
  nodeEnv?: string;
}) {
  for (const [name, value] of [
    ["EMAIL_FROM", from],
    ["NEXT_PUBLIC_APP_URL", appUrl],
    ["RESEND_API_KEY", key],
  ] as const) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
  vi.stubEnv("NODE_ENV", nodeEnv ?? "test");
  delete process.env.VERCEL_ENV;
  delete process.env.PERX_DEPLOY_ENV;
}

function captureLogs() {
  const logs: string[] = [];
  for (const level of ["debug", "error", "info", "log", "warn"] as const) {
    vi.spyOn(console, level).mockImplementation((...args: unknown[]) => {
      logs.push(args.map((a) => JSON.stringify(a)).join(" "));
    });
  }
  return logs;
}

function deliverInput() {
  return {
    email: SENTINEL_TO,
    expiresAt: new Date("2026-01-01T00:30:00.000Z"),
    resetUrl: `https://app.example.invalid/reset-password?token=${SENTINEL_TOKEN}`,
  };
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  process.env = { ...savedEnv };
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("isPasswordResetDeliveryConfigured", () => {
  it("is false in development with only the console seam", async () => {
    configure({ nodeEnv: "development" });
    const m = await import("@/lib/auth/password-reset-delivery");

    // The console seam helps a developer; it does not reach an inbox.
    expect(m.isPasswordResetDeliveryConfigured()).toBe(false);
  });

  it("is false in production with no provider", async () => {
    configure({ nodeEnv: "production" });
    const m = await import("@/lib/auth/password-reset-delivery");

    expect(m.isPasswordResetDeliveryConfigured()).toBe(false);
  });

  it("is true in production when the provider is fully configured", async () => {
    configure({
      appUrl: "https://www.example.invalid",
      from: SENTINEL_FROM,
      key: SENTINEL_KEY,
      nodeEnv: "production",
    });
    const m = await import("@/lib/auth/password-reset-delivery");

    expect(m.isPasswordResetDeliveryConfigured()).toBe(true);
  });

  it("is true in development when the provider is fully configured", async () => {
    configure({
      appUrl: "https://www.example.invalid",
      from: SENTINEL_FROM,
      key: SENTINEL_KEY,
      nodeEnv: "development",
    });
    const m = await import("@/lib/auth/password-reset-delivery");

    // Capability, not mode: NODE_ENV must not drive this answer.
    expect(m.isPasswordResetDeliveryConfigured()).toBe(true);
  });

  it("is false for partial configuration in either environment", async () => {
    for (const nodeEnv of ["development", "production"]) {
      vi.resetModules();
      configure({ key: SENTINEL_KEY, nodeEnv });
      const keyOnly = await import("@/lib/auth/password-reset-delivery");
      expect(keyOnly.isPasswordResetDeliveryConfigured()).toBe(false);

      vi.resetModules();
      configure({ from: SENTINEL_FROM, nodeEnv });
      const fromOnly = await import("@/lib/auth/password-reset-delivery");
      expect(fromOnly.isPasswordResetDeliveryConfigured()).toBe(false);
    }
  });
});

describe("deliverPasswordResetLink", () => {
  it("logs to the console in development and returns logged", async () => {
    configure({ nodeEnv: "development" });
    const logs = captureLogs();
    const m = await import("@/lib/auth/password-reset-delivery");

    const result = await m.passwordResetDelivery.deliverPasswordResetLink(
      deliverInput(),
    );

    expect(result.status).toBe("logged");
    expect(fetchMock).not.toHaveBeenCalled();
    // The development seam is explicitly allowed to print the link.
    expect(logs.join("\n")).toContain(SENTINEL_TOKEN);
  });

  it("returns unconfigured in production and prints no credential", async () => {
    configure({ nodeEnv: "production" });
    const logs = captureLogs();
    const m = await import("@/lib/auth/password-reset-delivery");

    const result = await m.passwordResetDelivery.deliverPasswordResetLink(
      deliverInput(),
    );

    expect(result.status).toBe("unconfigured");
    expect(fetchMock).not.toHaveBeenCalled();
    const combined = logs.join("\n");
    expect(combined).not.toContain(SENTINEL_TOKEN);
    expect(combined).not.toContain(SENTINEL_TO);
    expect(combined).not.toContain("/reset-password?token=");
  });

  it("attempts provider delivery in production when configured", async () => {
    configure({
      appUrl: "https://www.example.invalid",
      from: SENTINEL_FROM,
      key: SENTINEL_KEY,
      nodeEnv: "production",
    });
    fetchMock.mockResolvedValue({
      json: async () => ({ id: "resend-1" }),
      ok: true,
      status: 200,
    });
    const m = await import("@/lib/auth/password-reset-delivery");

    const result = await m.passwordResetDelivery.deliverPasswordResetLink(
      deliverInput(),
    );

    expect(result.status).toBe("delivered");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns a safe failure when the provider rejects, without throwing", async () => {
    configure({
      appUrl: "https://www.example.invalid",
      from: SENTINEL_FROM,
      key: SENTINEL_KEY,
      nodeEnv: "production",
    });
    fetchMock.mockRejectedValue(new Error("ECONNREFUSED"));
    const logs = captureLogs();
    const m = await import("@/lib/auth/password-reset-delivery");

    const result = await m.passwordResetDelivery.deliverPasswordResetLink(
      deliverInput(),
    );

    expect(result.status).toBe("failed");
    const combined = logs.join("\n");
    expect(combined).not.toContain(SENTINEL_TOKEN);
    expect(combined).not.toContain(SENTINEL_KEY);
  });

  it("prefers a real provider over the console seam in development", async () => {
    configure({
      appUrl: "https://www.example.invalid",
      from: SENTINEL_FROM,
      key: SENTINEL_KEY,
      nodeEnv: "development",
    });
    fetchMock.mockResolvedValue({
      json: async () => ({ id: "resend-1" }),
      ok: true,
      status: 200,
    });
    const m = await import("@/lib/auth/password-reset-delivery");

    const result = await m.passwordResetDelivery.deliverPasswordResetLink(
      deliverInput(),
    );

    expect(result.status).toBe("delivered");
  });
});

describe("buildPasswordResetUrl", () => {
  it("builds an absolute url from the configured origin", async () => {
    configure({ appUrl: "https://www.example.invalid", nodeEnv: "production" });
    const m = await import("@/lib/auth/password-reset-delivery");

    const url = m.buildPasswordResetUrl(SENTINEL_TOKEN);

    expect(url).toBe(
      `https://www.example.invalid/reset-password?token=${SENTINEL_TOKEN}`,
    );
  });

  it("never returns a relative url", async () => {
    configure({ nodeEnv: "production" });
    const m = await import("@/lib/auth/password-reset-delivery");

    const url = m.buildPasswordResetUrl(SENTINEL_TOKEN);

    // A relative link is unusable in an email client.
    expect(url.startsWith("/")).toBe(false);
  });

  it("refuses to hand a localhost link to a real provider", async () => {
    /*
     * The documented "relative fallback" does not exist: getServerEnv()
     * defaults NEXT_PUBLIC_APP_URL to http://localhost:3000. So with the origin
     * unset but a provider configured, the old code would have mailed a
     * localhost link to a real inbox. Delivery must refuse instead.
     */
    configure({
      from: SENTINEL_FROM,
      key: SENTINEL_KEY,
      nodeEnv: "production",
    });
    const logs = captureLogs();
    const m = await import("@/lib/auth/password-reset-delivery");

    const result = await m.passwordResetDelivery.deliverPasswordResetLink({
      ...deliverInput(),
      resetUrl: m.buildPasswordResetUrl(SENTINEL_TOKEN),
    });

    expect(result.status).not.toBe("delivered");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(logs.join("\n")).not.toContain(SENTINEL_TOKEN);
  });
});

describe("password reset email content", () => {
  it("includes both text and html, the link, and expiry guidance", async () => {
    const { buildPasswordResetEmail } = await import(
      "@/lib/email/templates/password-reset"
    );

    const url = `https://www.example.invalid/reset-password?token=${SENTINEL_TOKEN}`;
    const built = buildPasswordResetEmail({
      expiresAt: new Date("2026-01-01T00:30:00.000Z"),
      resetUrl: url,
    });

    expect(built.text).toContain(url);
    expect(built.html).toContain(url);
    expect(built.subject).toMatch(/password/i);
    expect(built.text).toMatch(/30 minutes|expires/i);
    // Must not assert the recipient personally requested it.
    expect(built.text).not.toMatch(/you requested/i);
    expect(built.text).toMatch(/was requested/i);
    expect(built.text).toMatch(/ignore/i);
    expect(built.text).toMatch(/unchanged/i);
  });

  it("uses no repository-relative or data-uri imagery", async () => {
    const { buildPasswordResetEmail } = await import(
      "@/lib/email/templates/password-reset"
    );

    const built = buildPasswordResetEmail({
      expiresAt: new Date("2026-01-01T00:30:00.000Z"),
      resetUrl: "https://www.example.invalid/reset-password?token=x",
    });

    expect(built.html).not.toContain("data:image");
    expect(built.html).not.toMatch(/src="\//);
    expect(built.html).not.toContain("../public/");
  });
});
