import { randomUUID } from "node:crypto";
import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import * as databaseModule from "@/lib/db/prisma";
import {
  createSession,
  destroySession,
  getCurrentUser,
  validateCurrentSessionAccess,
} from "@/lib/auth/session";
import { supabaseSignUp, supabaseSignIn } from "@/lib/auth/supabase-flow";
import { setCachedDataModeForTest } from "@/lib/env";
import {
  createAuthorizationDatabase,
  withAuthorizationTransaction,
  authorizationFixtures,
  type AuthorizationFixtures,
} from "../utils/authorization-fixtures";
import { getIsolatedTestDatabaseUrl } from "../e2e/utils/db-guard";
const m = vi.hoisted(() => ({
  jar: new Map<string, string>(),
  identity: vi.fn(),
  signUp: vi.fn(),
  signIn: vi.fn(),
  clear: vi.fn(),
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (n: string) => (m.jar.has(n) ? { value: m.jar.get(n) } : undefined),
    has: (n: string) => m.jar.has(n),
    set: (n: string, v: string) => m.jar.set(n, v),
    getAll: () => [...m.jar].map(([name, value]) => ({ name, value })),
  }),
  headers: async () => new Headers(),
}));
vi.mock("@/lib/auth/supabase-server", () => ({
  getVerifiedSupabaseIdentity: m.identity,
  clearSupabaseSession: m.clear,
  createSupabaseServerClient: async () => ({
    auth: { signUp: m.signUp, signInWithPassword: m.signIn },
  }),
  RECOVERY_COOKIE: "recovery",
}));
vi.mock("@/lib/auth/supabase-config", () => ({
  authEmailRedirect: () => "http://127.0.0.1:3100/auth/confirm",
}));
const url = getIsolatedTestDatabaseUrl();
const suite = url ? describe : describe.skip;
suite(
  "Supabase identity bridge with real PostgreSQL application authorization",
  () => {
    let database: ReturnType<typeof createAuthorizationDatabase>;
    beforeAll(async () => {
      database = createAuthorizationDatabase();
      await database.$queryRaw`SELECT 1`;
      vi.stubEnv("DATABASE_URL", url!);
      vi.stubEnv("DIRECT_URL", url!);
      vi.stubEnv("PERX_AUTH_PROVIDER", "supabase");
      vi.stubEnv("PERX_SIGNUP_MODE", "public");
      setCachedDataModeForTest("database");
    }, 30_000);
    afterAll(async () => {
      await database?.$disconnect();
      vi.unstubAllEnvs();
      setCachedDataModeForTest(undefined);
    });
    function dbTest(
      name: string,
      run: (f: AuthorizationFixtures) => Promise<void>,
    ) {
      it(
        name,
        async () => {
          m.jar.clear();
          vi.clearAllMocks();
          await withAuthorizationTransaction(database, async (prisma) => {
            const spy = vi
              .spyOn(databaseModule, "getPrisma")
              .mockReturnValue(prisma);
            try {
              await run(authorizationFixtures(prisma));
            } finally {
              spy.mockRestore();
              m.jar.clear();
            }
          });
        },
        20000,
      );
    }
    async function linked(f: AuthorizationFixtures) {
      const user = await f.user();
      const authUserId = randomUUID();
      await f.prisma.user.update({
        where: { id: user.id },
        data: { authUserId },
      });
      m.identity.mockResolvedValue({
        id: authUserId,
        email_confirmed_at: "2026-09-01",
      });
      return { ...user, authUserId };
    }
    dbTest(
      "signup stores the provider UUID with independent cuid, membership, profile and audit",
      async (f) => {
        const authUserId = randomUUID(),
          email = `new-${randomUUID()}@ptahx.test`;
        m.signUp.mockResolvedValue({
          data: {
            user: { id: authUserId, email, identities: [{}] },
            session: null,
          },
          error: null,
        });
        await expect(
          supabaseSignUp(
            {
              email,
              name: "New member",
              username: `new_${randomUUID().slice(0, 20)}`,
              password: "Localtest12345",
              confirmPassword: "Localtest12345",
              termsAccepted: true,
            },
            {},
          ),
        ).rejects.toMatchObject({
          digest: expect.stringContaining("confirmation=required"),
        });
        const user = await f.prisma.user.findUniqueOrThrow({
          where: { authUserId },
          include: { profile: true, roles: { include: { role: true } } },
        });
        expect(user.id).not.toBe(authUserId);
        expect(user.profile).not.toBeNull();
        expect(user.roles.map((r) => r.role.name)).toEqual(["MEMBER"]);
        expect(
          await f.prisma.session.count({ where: { userId: user.id } }),
        ).toBe(0);
        expect(
          await f.prisma.auditLog.count({
            where: { entityId: user.id, action: "auth.supabase.sign_up" },
          }),
        ).toBe(1);
      },
    );
    dbTest("PostgreSQL rejects duplicate UUID bridges", async (f) => {
      const a = await linked(f),
        b = await f.user();
      await expect(
        f.prisma.$transaction((tx) =>
          tx.user.update({
            where: { id: b.id },
            data: { authUserId: a.authUserId },
          }),
        ),
      ).rejects.toMatchObject({ code: "P2002" });
    });
    dbTest(
      "verified identity resolves the application roles and logout revokes a replayed local cookie",
      async (f) => {
        const a = await linked(f);
        await createSession(a.id);
        const saved = [...m.jar];
        expect(await getCurrentUser()).toMatchObject({
          id: a.id,
          roles: ["MEMBER"],
        });
        await destroySession();
        expect(m.clear).toHaveBeenCalled();
        m.jar.clear();
        for (const [k, v] of saved) m.jar.set(k, v);
        expect(await getCurrentUser()).toBeNull();
      },
    );
    for (const state of ["unverified", "unknown", "unlinked"] as const)
      dbTest(
        `rejects ${state} provider state with otherwise valid local session`,
        async (f) => {
          const a = await linked(f);
          await createSession(a.id);
          if (state === "unlinked")
            await f.prisma.user.update({
              where: { id: a.id },
              data: { authUserId: null },
            });
          else
            m.identity.mockResolvedValue({
              id: state === "unknown" ? randomUUID() : a.authUserId,
              email: a.email,
              email_confirmed_at: state === "unverified" ? null : "2026-09-01",
            });
          expect(await getCurrentUser()).toBeNull();
          expect(await validateCurrentSessionAccess()).toBe(false);
        },
      );
    for (const state of ["banned", "deactivated", "suspended"] as const)
      dbTest(
        `valid Supabase identity cannot bypass ${state} application enforcement`,
        async (f) => {
          const a = await linked(f);
          await createSession(a.id);
          await f.prisma.user.update({
            where: { id: a.id },
            data:
              state === "banned"
                ? { bannedAt: new Date() }
                : state === "deactivated"
                  ? { deactivatedAt: new Date() }
                  : {
                      suspendedAt: new Date(),
                      suspendedUntil: new Date("2099-01-01"),
                    },
          });
          expect(await getCurrentUser()).toBeNull();
          expect(
            await f.prisma.session.count({ where: { userId: a.id } }),
          ).toBe(0);
        },
      );
    dbTest(
      "sign-in uses the linked UUID and cannot use an unrelated email match",
      async (f) => {
        const a = await linked(f);
        m.signIn.mockResolvedValue({
          data: {
            user: {
              id: randomUUID(),
              email: a.email,
              email_confirmed_at: "2026-09-01",
            },
            session: {},
          },
          error: null,
        });
        expect(
          (
            await supabaseSignIn(
              { email: a.email, password: "Anytest123" },
              "/app",
              {},
            )
          ).status,
        ).toBe("error");
        expect(await f.prisma.session.count({ where: { userId: a.id } })).toBe(
          0,
        );
      },
    );
  },
);
