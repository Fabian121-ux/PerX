import { randomUUID } from "node:crypto";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Prisma } from "@/generated/prisma/client";
import type {
  DealStatus,
  ProposalStatus,
  RoleName,
} from "@/generated/prisma/enums";
import { enforceTestDatabaseIsolation } from "../e2e/utils/db-guard";

export function createAuthorizationDatabase() {
  enforceTestDatabaseIsolation();
  return new PrismaClient({
    adapter: new PrismaPg({
      connectionString: process.env.TEST_DATABASE_URL!,
      connectionTimeoutMillis: 5_000,
    }),
  });
}

/** Real SQL throughout. Rollback also removes immutable versions and audit rows.
 * Production actions open their own transactions; savepoints preserve their
 * atomicity inside the test transaction, including expected constraint errors.
 * Only callback transactions are supported: fail loudly on an unsupported use.
 */
export async function withAuthorizationTransaction(
  database: PrismaClient,
  run: (prisma: PrismaClient) => Promise<void>,
) {
  enforceTestDatabaseIsolation();
  const rollback = new Error("Roll back authorization fixture");
  try {
    await database.$transaction(
      async (tx) => {
        let sequence = 0;
        const client = new Proxy(tx, {
          get(target, property) {
            if (property !== "$transaction")
              return Reflect.get(target, property);
            return async (
              callback: (nested: Prisma.TransactionClient) => Promise<unknown>,
            ) => {
              if (typeof callback !== "function") {
                throw new Error(
                  "Authorization fixtures require callback transactions",
                );
              }
              const savepoint = `authz_${++sequence}`;
              await tx.$executeRawUnsafe(`SAVEPOINT ${savepoint}`);
              try {
                const result = await callback(client);
                await tx.$executeRawUnsafe(`RELEASE SAVEPOINT ${savepoint}`);
                return result;
              } catch (error) {
                await tx.$executeRawUnsafe(
                  `ROLLBACK TO SAVEPOINT ${savepoint}`,
                );
                await tx.$executeRawUnsafe(`RELEASE SAVEPOINT ${savepoint}`);
                throw error;
              }
            };
          },
        }) as PrismaClient;
        await run(client);
        throw rollback;
      },
      { timeout: 15_000 },
    );
  } catch (error) {
    if (error !== rollback) throw error;
  }
}

export function authorizationFixtures(prisma: PrismaClient) {
  const namespace = randomUUID();
  const userIds: string[] = [];

  async function user(roles: RoleName[] = ["MEMBER"]) {
    const id = randomUUID();
    const roleIds: string[] = [];
    for (const name of roles) {
      const role = await prisma.role.upsert({
        where: { name },
        update: {},
        create: { name, label: name, description: "Authorization test role" },
      });
      roleIds.push(role.id);
    }
    const row = await prisma.user.create({
      data: {
        email: `authz-${id}@ptahx.test`,
        username: `authz_${id.replaceAll("-", "").slice(0, 24)}`,
        name: "Authorization fixture member",
        passwordHash: "unused-fixture-password-hash",
        accountClassification: "PUBLIC_BETA_USER",
        isActive: true,
        profile: {
          create: {
            headline: "Authorization test member",
            biography: "Isolated authorization fixture",
            location: "Lagos",
            isDiscoverable: true,
            allowConnectionRequests: true,
            allowMessagesFromConnections: true,
          },
        },
        roles: { create: roleIds.map((roleId) => ({ roleId })) },
      },
    });
    userIds.push(row.id);
    return row;
  }

  async function opportunity(
    ownerId: string,
    overrides: Partial<Prisma.OpportunityUncheckedCreateInput> = {},
  ) {
    return prisma.opportunity.create({
      data: {
        ownerId,
        type: "SERVICE",
        status: "PUBLISHED",
        moderationStatus: "APPROVED",
        publishedAt: new Date(),
        title: `Software delivery ${namespace}`,
        slug: `authz-${randomUUID()}`,
        summary: "Professional software delivery service.",
        description:
          "Professional software delivery including implementation, testing and documentation for a complete project.",
        ...overrides,
      },
    });
  }

  async function conversation(userIds: string[]) {
    return prisma.conversation.create({
      data: {
        participants: { create: userIds.map((userId) => ({ userId })) },
        messages: {
          create: { senderId: userIds[0], body: "Private fixture message" },
        },
      },
      include: { participants: true, messages: true },
    });
  }

  async function proposal(
    senderId: string,
    opportunityId: string,
    status: ProposalStatus = "SENT",
  ) {
    return prisma.proposal.create({
      data: {
        senderId,
        opportunityId,
        status,
        amountMinor: 100000n,
        currency: "NGN",
        deliveryDays: 7,
        description: `Authorization proposal ${namespace}`,
        versions: {
          create: {
            createdById: senderId,
            amountMinor: 100000n,
            currency: "NGN",
            deliveryDays: 7,
            description: `Authorization proposal ${namespace}`,
            includedRevisions: 1,
            versionNumber: 1,
            status:
              status === "DRAFT"
                ? "DRAFT"
                : status === "ACCEPTED"
                  ? "ACCEPTED"
                  : "SUBMITTED",
            submittedAt: status === "DRAFT" ? null : new Date(),
            acceptedAt: status === "ACCEPTED" ? new Date() : null,
          },
        },
      },
      include: { versions: true },
    });
  }

  async function deal(
    clientId: string,
    providerId: string,
    status: DealStatus,
  ) {
    const listing = await opportunity(clientId);
    const terms = await proposal(providerId, listing.id, "ACCEPTED");
    return prisma.deal.create({
      data: {
        opportunityId: listing.id,
        proposalId: terms.id,
        proposalVersionId: terms.versions[0].id,
        status,
        settlementMode: "PROVIDER_DISABLED",
        currency: "NGN",
        valueMinor: terms.amountMinor,
        participants: {
          create: [
            { userId: clientId, role: "client" },
            { userId: providerId, role: "provider" },
          ],
        },
      },
      include: { participants: true, releases: true },
    });
  }

  return {
    namespace,
    userIds,
    user,
    opportunity,
    conversation,
    proposal,
    deal,
    prisma,
  };
}

export type AuthorizationFixtures = ReturnType<typeof authorizationFixtures>;
