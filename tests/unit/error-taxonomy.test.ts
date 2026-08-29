import { describe, expect, it } from "vitest";

import {
  classifyError,
  describeError,
  presentError,
} from "@/lib/errors/taxonomy";

describe("error taxonomy", () => {
  it("classifies transport failures as NETWORK", () => {
    expect(classifyError(new TypeError("Failed to fetch"))).toBe("NETWORK");
    expect(classifyError(new Error("NetworkError when attempting to"))).toBe(
      "NETWORK",
    );
    expect(classifyError(new Error("connect ECONNREFUSED 127.0.0.1"))).toBe(
      "NETWORK",
    );
  });

  it("classifies HTTP status codes", () => {
    expect(classifyError({ status: 401 })).toBe("AUTH_REQUIRED");
    expect(classifyError({ status: 403 })).toBe("FEATURE_GATE");
    expect(classifyError({ status: 404 })).toBe("NOT_FOUND");
    expect(classifyError({ status: 409 })).toBe("CONFLICT");
    expect(classifyError({ status: 422 })).toBe("VALIDATION");
    expect(classifyError({ status: 429 })).toBe("RATE_LIMIT");
    expect(classifyError({ status: 503 })).toBe("DEPENDENCY_FAILURE");
    expect(classifyError({ status: 504 })).toBe("TIMEOUT");
    expect(classifyError({ status: 500 })).toBe("SERVER_ERROR");
  });

  it("treats an opaque production error as UNKNOWN, not NETWORK", () => {
    // Next.js strips the message in production and leaves only a digest. The
    // boundary genuinely does not know the cause, and must not guess.
    const opaque = Object.assign(new Error(""), { digest: "1234567890" });
    expect(classifyError(opaque)).toBe("UNKNOWN");
  });

  it("never blames the network for a server error", () => {
    const serverError = presentError({ status: 500 }, "your workspace");
    expect(serverError.kind).toBe("SERVER_ERROR");
    expect(serverError.description.toLowerCase()).not.toContain("connection");
    expect(serverError.description.toLowerCase()).not.toContain("offline");
  });

  it("never blames the network for an unknown failure", () => {
    const unknown = presentError(new Error("kaboom"), "your workspace");
    expect(unknown.kind).toBe("UNKNOWN");
    expect(unknown.description.toLowerCase()).not.toContain("connection");
    expect(unknown.description.toLowerCase()).not.toContain("offline");
  });

  it("only mentions connectivity for genuine transport failures", () => {
    const network = presentError(new TypeError("Failed to fetch"));
    expect(network.kind).toBe("NETWORK");
    expect(network.description.toLowerCase()).toContain("connection");
    expect(network.canRetry).toBe(true);
  });

  it("does not offer retry where retry cannot help", () => {
    expect(describeError("AUTH_REQUIRED").canRetry).toBe(false);
    expect(describeError("FEATURE_GATE").canRetry).toBe(false);
    expect(describeError("NOT_FOUND").canRetry).toBe(false);
    expect(describeError("VALIDATION").canRetry).toBe(false);
  });

  it("offers retry where it plausibly helps", () => {
    for (const kind of [
      "NETWORK",
      "TIMEOUT",
      "SERVER_ERROR",
      "DEPENDENCY_FAILURE",
      "RATE_LIMIT",
      "UNKNOWN",
    ] as const) {
      expect(describeError(kind).canRetry, kind).toBe(true);
    }
  });

  it("keeps a feature gate distinct from not-found", () => {
    expect(describeError("FEATURE_GATE").title).not.toMatch(/not found/i);
    expect(describeError("NOT_FOUND").title).toMatch(/not found/i);
  });

  it("never leaks raw infrastructure detail into user copy", () => {
    const leaky = new Error(
      'Invalid `prisma.user.findMany()` postgresql://user:secret@db:5432/perx',
    );
    const presented = presentError(leaky, "your workspace");
    expect(presented.description).not.toContain("postgresql://");
    expect(presented.description).not.toContain("secret");
    expect(presented.description).not.toContain("prisma");
  });
});
