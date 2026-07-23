import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  BETA_FULL_MESSAGE,
  REGISTRATION_CLOSED_MESSAGE,
  checkRegistrationGate,
  getRegistrationStatus,
} from "@/lib/registration/status";

const originalEnv = { ...process.env };

function resetEnv() {
  process.env = { ...originalEnv };
  delete process.env.PERX_BETA_MAX_USERS;
  delete process.env.PERX_DATA_MODE;
  delete process.env.PERX_SIGNUP_MODE;
}

function fakeRegistrationClient(publicBetaUsers: number) {
  const count = vi.fn().mockResolvedValue(publicBetaUsers);
  const lock = vi.fn().mockResolvedValue(1);

  return {
    $executeRawUnsafe: lock,
    user: { count },
  };
}

describe("registration status and gate", () => {
  beforeEach(() => {
    resetEnv();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("keeps missing signup mode closed", async () => {
    const client = fakeRegistrationClient(0);

    await expect(checkRegistrationGate(client)).resolves.toMatchObject({
      allowed: false,
      message: REGISTRATION_CLOSED_MESSAGE,
      reason: "closed",
    });
    expect(client.$executeRawUnsafe).not.toHaveBeenCalled();
    expect(client.user.count).not.toHaveBeenCalled();
  });

  it("allows open-beta signup without invitations while capacity remains", async () => {
    process.env.PERX_SIGNUP_MODE = "open_beta";
    process.env.PERX_BETA_MAX_USERS = "10";
    const client = fakeRegistrationClient(9);

    await expect(checkRegistrationGate(client)).resolves.toMatchObject({
      allowed: true,
      config: { maximumUsers: 10, mode: "open_beta" },
    });
    expect(client.$executeRawUnsafe).toHaveBeenCalledWith(
      "SELECT pg_advisory_xact_lock($1)",
      expect.any(Number),
    );
  });

  it("counts only ordinary public beta users for open-beta capacity", async () => {
    process.env.PERX_SIGNUP_MODE = "open_beta";
    process.env.PERX_BETA_MAX_USERS = "10";
    const client = fakeRegistrationClient(3);

    await checkRegistrationGate(client);

    expect(client.user.count).toHaveBeenCalledWith({
      where: {
        accountClassification: "PUBLIC_BETA_USER",
        isActive: true,
        roles: {
          none: {
            role: {
              name: "ADMIN",
            },
          },
        },
      },
    });
  });

  it("locks capacity before counting users", async () => {
    process.env.PERX_SIGNUP_MODE = "open_beta";
    process.env.PERX_BETA_MAX_USERS = "10";
    const client = fakeRegistrationClient(4);

    await checkRegistrationGate(client);

    expect(client.$executeRawUnsafe.mock.invocationCallOrder[0]).toBeLessThan(
      client.user.count.mock.invocationCallOrder[0],
    );
  });

  it("rejects the eleventh user when the limit is ten", async () => {
    process.env.PERX_SIGNUP_MODE = "open_beta";
    process.env.PERX_BETA_MAX_USERS = "10";
    const client = fakeRegistrationClient(10);

    await expect(checkRegistrationGate(client)).resolves.toMatchObject({
      allowed: false,
      message: BETA_FULL_MESSAGE,
      reason: "full",
    });
  });

  it("allows additional users after the configured limit increases", async () => {
    process.env.PERX_SIGNUP_MODE = "open_beta";
    process.env.PERX_BETA_MAX_USERS = "25";
    const client = fakeRegistrationClient(10);

    await expect(checkRegistrationGate(client)).resolves.toMatchObject({
      allowed: true,
      config: { maximumUsers: 25, mode: "open_beta" },
    });
  });

  it("does not consume or count capacity in public mode", async () => {
    process.env.PERX_SIGNUP_MODE = "public";
    const client = fakeRegistrationClient(10);

    await expect(checkRegistrationGate(client)).resolves.toMatchObject({
      allowed: true,
      config: { maximumUsers: null, mode: "public" },
    });
    expect(client.$executeRawUnsafe).not.toHaveBeenCalled();
    expect(client.user.count).not.toHaveBeenCalled();
  });

  it("keeps local mock-mode status informational without mock user counts", async () => {
    process.env.PERX_SIGNUP_MODE = "open_beta";
    process.env.PERX_BETA_MAX_USERS = "10";
    process.env.PERX_DATA_MODE = "mock";

    await expect(getRegistrationStatus()).resolves.toEqual({
      maximumUsers: 10,
      mode: "open_beta",
      registrationOpen: true,
      remainingPlaces: null,
    });
  });
});
