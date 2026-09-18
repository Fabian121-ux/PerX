import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * EMAIL-1: the provider seam.
 *
 * The invariant these tests defend is the one the work item names first:
 *
 *     NO PROVIDER CONFIGURED -> NO EXTERNAL EMAIL IS SENT.
 *
 * Disabled is the default, partial configuration is treated as no
 * configuration, and no provider exception is allowed to escape into a caller.
 * Every external interaction is mocked: nothing here may touch the network.
 */

const SENTINEL_KEY = "NOT-A-REAL-KEY-sentinel-value-for-tests-only";
const SENTINEL_FROM = "PtahX <sentinel-from@example.invalid>";
const SENTINEL_TO = "sentinel-recipient@example.invalid";
const SENTINEL_URL =
  "https://app.example.invalid/reset-password?token=SENTINEL_TOKEN_VALUE";

const fetchMock = vi.fn();

function setConfig({
  from,
  key,
  nodeEnv,
}: {
  from?: string;
  key?: string;
  nodeEnv?: string;
}) {
  if (key === undefined) delete process.env.RESEND_API_KEY;
  else process.env.RESEND_API_KEY = key;
  if (from === undefined) delete process.env.EMAIL_FROM;
  else process.env.EMAIL_FROM = from;
  vi.stubEnv("NODE_ENV", nodeEnv ?? "production");
}

function message() {
  return {
    html: `<p>${SENTINEL_URL}</p>`,
    idempotencyKey: "reset-abc123",
    subject: "Reset your PtahX password",
    text: `Reset link: ${SENTINEL_URL}`,
    to: SENTINEL_TO,
  };
}

const savedEnv = { ...process.env };

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
  setConfig({});
});

afterEach(() => {
  process.env = { ...savedEnv };
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("provider selection", () => {
  it("defaults to the disabled provider in production when nothing is configured", async () => {
    const { getEmailProvider } = await import("@/lib/email/service");

    expect(getEmailProvider().id).toBe("disabled");
  });

  it("uses the development console seam outside production", async () => {
    setConfig({ nodeEnv: "development" });
    const { getEmailProvider, isEmailDeliveryConfigured } = await import(
      "@/lib/email/service"
    );

    // Selectable, but explicitly NOT "configured": it reaches a terminal.
    expect(getEmailProvider().id).toBe("development-console");
    expect(isEmailDeliveryConfigured()).toBe(false);
  });

  it("selects resend only when BOTH key and from-address are present", async () => {
    setConfig({ from: SENTINEL_FROM, key: SENTINEL_KEY });
    const { getEmailProvider } = await import("@/lib/email/service");

    expect(getEmailProvider().id).toBe("resend");
  });

  it("stays disabled with an API key but no EMAIL_FROM", async () => {
    setConfig({ key: SENTINEL_KEY });
    const { getEmailProvider, isEmailDeliveryConfigured } = await import(
      "@/lib/email/service"
    );

    expect(getEmailProvider().id).toBe("disabled");
    expect(isEmailDeliveryConfigured()).toBe(false);
  });

  it("stays disabled with EMAIL_FROM but no API key", async () => {
    setConfig({ from: SENTINEL_FROM });
    const { getEmailProvider, isEmailDeliveryConfigured } = await import(
      "@/lib/email/service"
    );

    expect(getEmailProvider().id).toBe("disabled");
    expect(isEmailDeliveryConfigured()).toBe(false);
  });

  it("treats blank/whitespace configuration as absent", async () => {
    setConfig({ from: "   ", key: "   " });
    const { getEmailProvider, isEmailDeliveryConfigured } = await import(
      "@/lib/email/service"
    );

    expect(getEmailProvider().id).toBe("disabled");
    expect(isEmailDeliveryConfigured()).toBe(false);
  });

  it("reports configured only when a real provider can actually send", async () => {
    const unconfigured = await import("@/lib/email/service");
    expect(unconfigured.isEmailDeliveryConfigured()).toBe(false);

    vi.resetModules();
    setConfig({ from: SENTINEL_FROM, key: SENTINEL_KEY });
    const configured = await import("@/lib/email/service");
    expect(configured.isEmailDeliveryConfigured()).toBe(true);
  });
});

describe("disabled provider", () => {
  it("returns unconfigured, sends nothing, and never throws", async () => {
    const { getEmailProvider } = await import("@/lib/email/service");

    const result = await getEmailProvider().send(message());

    expect(result).toEqual({ provider: "disabled", status: "unconfigured" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("resend provider", () => {
  beforeEach(() => {
    setConfig({ from: SENTINEL_FROM, key: SENTINEL_KEY });
  });

  it("returns delivered on a 2xx and sends exactly once", async () => {
    fetchMock.mockResolvedValue({
      json: async () => ({ id: "resend-message-1" }),
      ok: true,
      status: 200,
    });
    const { getEmailProvider } = await import("@/lib/email/service");

    const result = await getEmailProvider().send(message());

    expect(result.status).toBe("delivered");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns a safe failure on a non-2xx rather than throwing", async () => {
    fetchMock.mockResolvedValue({
      json: async () => ({ message: "invalid from address" }),
      ok: false,
      status: 422,
      text: async () => "invalid from address",
    });
    const { getEmailProvider } = await import("@/lib/email/service");

    const result = await getEmailProvider().send(message());

    expect(result.status).toBe("failed");
    if (result.status !== "failed") throw new Error("unreachable");
    expect(result.reason).toBe("rejected");
    // The raw provider body must not ride along in the result.
    expect(JSON.stringify(result)).not.toContain("invalid from address");
  });

  it("classifies auth failures distinctly but safely", async () => {
    fetchMock.mockResolvedValue({
      json: async () => ({ message: "API key is invalid" }),
      ok: false,
      status: 401,
      text: async () => "API key is invalid",
    });
    const { getEmailProvider } = await import("@/lib/email/service");

    const result = await getEmailProvider().send(message());

    expect(result.status).toBe("failed");
    if (result.status !== "failed") throw new Error("unreachable");
    expect(result.reason).toBe("unauthorized");
  });

  it("contains a network rejection inside the provider boundary", async () => {
    fetchMock.mockRejectedValue(new Error("ECONNREFUSED 10.0.0.1:443"));
    const { getEmailProvider } = await import("@/lib/email/service");

    const result = await getEmailProvider().send(message());

    expect(result.status).toBe("failed");
    if (result.status !== "failed") throw new Error("unreachable");
    expect(result.reason).toBe("network");
    expect(JSON.stringify(result)).not.toContain("ECONNREFUSED");
  });

  it("never returns the recipient, bodies, url, or key in the result", async () => {
    fetchMock.mockResolvedValue({
      json: async () => ({ id: "resend-message-1" }),
      ok: true,
      status: 200,
    });
    const { getEmailProvider } = await import("@/lib/email/service");

    const serialized = JSON.stringify(await getEmailProvider().send(message()));

    expect(serialized).not.toContain(SENTINEL_TO);
    expect(serialized).not.toContain(SENTINEL_URL);
    expect(serialized).not.toContain(SENTINEL_KEY);
    expect(serialized).not.toContain("SENTINEL_TOKEN_VALUE");
  });

  it("sends the credential to the provider but never logs it", async () => {
    fetchMock.mockResolvedValue({
      json: async () => ({ id: "resend-message-1" }),
      ok: true,
      status: 200,
    });
    const logs: string[] = [];
    for (const level of ["debug", "error", "info", "log", "warn"] as const) {
      vi.spyOn(console, level).mockImplementation((...args: unknown[]) => {
        logs.push(args.map((a) => JSON.stringify(a)).join(" "));
      });
    }

    const { getEmailProvider } = await import("@/lib/email/service");
    await getEmailProvider().send(message());

    const combined = logs.join("\n");
    expect(combined).not.toContain(SENTINEL_KEY);
    expect(combined).not.toContain(SENTINEL_URL);
    expect(combined).not.toContain(SENTINEL_TO);
    expect(combined).not.toContain("Authorization");
  });

  it("does not log the api key when reporting a failure", async () => {
    fetchMock.mockResolvedValue({
      json: async () => ({ message: "nope" }),
      ok: false,
      status: 500,
      text: async () => "nope",
    });
    const logs: string[] = [];
    for (const level of ["debug", "error", "info", "log", "warn"] as const) {
      vi.spyOn(console, level).mockImplementation((...args: unknown[]) => {
        logs.push(args.map((a) => JSON.stringify(a)).join(" "));
      });
    }

    const { getEmailProvider } = await import("@/lib/email/service");
    await getEmailProvider().send(message());

    const combined = logs.join("\n");
    expect(combined).not.toContain(SENTINEL_KEY);
    expect(combined).not.toContain(SENTINEL_TO);
    expect(combined).not.toContain(SENTINEL_URL);
  });
});
