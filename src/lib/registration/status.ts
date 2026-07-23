import { getPrisma } from "@/lib/db/prisma";
import {
  getSignupConfig,
  type SignupConfig,
  type SignupMode,
} from "@/lib/env";
import { logServerDataError } from "@/lib/logging/runtime";

export const REGISTRATION_CLOSED_MESSAGE =
  "Registration is currently closed.";
export const BETA_FULL_MESSAGE =
  "The current PerX beta group is full. Registration will reopen when more spaces become available.";
export const OPEN_BETA_NOTICE =
  "PerX is currently open to a limited number of beta users.";

const OPEN_BETA_CAPACITY_LOCK_KEY = 2026071801;

type RegistrationClient = {
  $executeRawUnsafe: (query: string, ...values: unknown[]) => Promise<unknown>;
  user: {
    count: (args: unknown) => Promise<number>;
  };
};

export type RegistrationGateResult =
  | {
      allowed: true;
      config: SignupConfig;
    }
  | {
      allowed: false;
      config: SignupConfig;
      message: string;
      reason: "closed" | "full";
    };

export type RegistrationStatus = {
  maximumUsers: number | null;
  mode: SignupMode;
  registrationOpen: boolean;
  remainingPlaces: number | null;
  statusUnavailable?: boolean;
};

function publicBetaUserCountWhere() {
  return {
    accountClassification: "PUBLIC_BETA_USER",
    isActive: true,
    roles: {
      none: {
        role: {
          name: "ADMIN",
        },
      },
    },
  };
}

async function countPublicBetaUsers(client: RegistrationClient) {
  return client.user.count({
    where: publicBetaUserCountWhere(),
  });
}

async function lockBetaCapacity(client: RegistrationClient) {
  await client.$executeRawUnsafe(
    "SELECT pg_advisory_xact_lock($1)",
    OPEN_BETA_CAPACITY_LOCK_KEY,
  );
}

export async function checkRegistrationGate(
  client: RegistrationClient,
): Promise<RegistrationGateResult> {
  const config = getSignupConfig();

  if (config.mode === "closed") {
    return {
      allowed: false,
      config,
      message: REGISTRATION_CLOSED_MESSAGE,
      reason: "closed",
    };
  }

  if (config.mode === "public") {
    return { allowed: true, config };
  }

  const maximumUsers = config.maximumUsers;
  if (maximumUsers === null) {
    throw new Error("Open beta registration is missing a maximum user count.");
  }

  await lockBetaCapacity(client);
  const publicBetaUsers = await countPublicBetaUsers(client);

  if (publicBetaUsers >= maximumUsers) {
    return {
      allowed: false,
      config,
      message: BETA_FULL_MESSAGE,
      reason: "full",
    };
  }

  return { allowed: true, config };
}

export async function getRegistrationStatus(): Promise<RegistrationStatus> {
  const config = getSignupConfig();

  if (config.mode === "closed") {
    return {
      maximumUsers: null,
      mode: config.mode,
      registrationOpen: false,
      remainingPlaces: null,
    };
  }

  if (config.mode === "public") {
    return {
      maximumUsers: null,
      mode: config.mode,
      registrationOpen: true,
      remainingPlaces: null,
    };
  }

  if (process.env.PERX_DATA_MODE === "mock") {
    return {
      maximumUsers: config.maximumUsers,
      mode: config.mode,
      registrationOpen: true,
      remainingPlaces: null,
    };
  }

  const maximumUsers = config.maximumUsers;
  if (maximumUsers === null) {
    throw new Error("Open beta registration is missing a maximum user count.");
  }

  const publicBetaUsers = await countPublicBetaUsers(
    getPrisma() as RegistrationClient,
  );
  const remainingPlaces = Math.max(maximumUsers - publicBetaUsers, 0);

  return {
    maximumUsers,
    mode: config.mode,
    registrationOpen: remainingPlaces > 0,
    remainingPlaces,
  };
}

export async function getSafeRegistrationStatus(
  route: string,
): Promise<RegistrationStatus> {
  try {
    return await getRegistrationStatus();
  } catch (error) {
    logServerDataError({
      error,
      operation: "registration.status",
      route,
    });

    return {
      maximumUsers: null,
      mode: "closed",
      registrationOpen: false,
      remainingPlaces: null,
      statusUnavailable: true,
    };
  }
}
