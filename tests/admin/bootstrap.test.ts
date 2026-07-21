import { describe, it, expect, vi, beforeEach } from "vitest";
import { bootstrapProductionAdmin } from "../../scripts/bootstrap-production-admin";

const mockPrismaClient = {
  user: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  role: {
    upsert: vi.fn(),
  },
  userRole: {
    create: vi.fn(),
  },
  auditLog: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  session: {
    deleteMany: vi.fn(),
  },
  $executeRaw: vi.fn(),
  $queryRaw: vi.fn(),
  $transaction: vi.fn(async (cb) => {
    return cb(mockPrismaClient);
  }),
};

vi.mock("../../src/lib/db/prisma", () => ({
  getPrisma: () => mockPrismaClient,
}));

describe("bootstrapProductionAdmin", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.clearAllMocks();

    process.env.PERX_ALLOW_PRODUCTION_ADMIN_BOOTSTRAP = "true";
    process.env.PERX_ADMIN_BOOTSTRAP_CONFIRM = "CREATE_PERX_PRODUCTION_ADMIN";
    process.env.PERX_DEPLOY_ENV = "production";
    process.env.PERX_DATABASE_LABEL = "perx-production";
    process.env.PERX_PRODUCTION_DATABASE_FINGERPRINT = "safe-fingerprint";
    process.env.PERX_ADMIN_EMAIL = "admin@example.com";
    process.env.PERX_ADMIN_USERNAME = "admin";
    process.env.PERX_ADMIN_FULL_NAME = "System Admin";
    process.env.PERX_ADMIN_BOOTSTRAP_MODE = "promote_existing";

    mockPrismaClient.role.upsert.mockResolvedValue({ id: "role_admin", name: "ADMIN" });
    
    mockPrismaClient.$executeRaw.mockResolvedValue(1);
    
    mockPrismaClient.$queryRaw.mockImplementation(async (query: unknown) => {
      let q = "";
      const queryObj = query as { strings?: string[] };
      if (queryObj && queryObj.strings) q = queryObj.strings[0];
      else if (Array.isArray(query)) q = query[0];
      else q = String(query);

      if (q.includes('_prisma_migrations')) {
        return [{ migration_name: '0002_open_beta_registration' }];
      }
      if (q.includes('AccountClassification')) {
        return [{ value: 'INTERNAL_ADMIN' }, { value: 'PUBLIC_BETA_USER' }];
      }
      return [];
    });
  });

  it("refuses an unidentified Production database", async () => {
    process.env.PERX_DATABASE_LABEL = "wrong-db";
    const result = await bootstrapProductionAdmin();
    expect(result).toBe(false);
  });

  it("fails on wrong or missing fingerprint", async () => {
    process.env.PERX_PRODUCTION_DATABASE_FINGERPRINT = "";
    const result = await bootstrapProductionAdmin();
    expect(result).toBe(false);
  });

  it("fails on pending or missing migration", async () => {
    mockPrismaClient.$queryRaw.mockImplementation(async (query: unknown) => {
      let q = "";
      const queryObj = query as { strings?: string[] };
      if (queryObj && queryObj.strings) q = queryObj.strings[0];
      else if (Array.isArray(query)) q = query[0];
      else q = String(query);

      if (q.includes('_prisma_migrations')) {
        return []; // Simulate missing migration
      }
      return [{ value: 'INTERNAL_ADMIN' }, { value: 'PUBLIC_BETA_USER' }];
    });
    const result = await bootstrapProductionAdmin();
    expect(result).toBe(false);
  });

  it("promote-existing default and missing existing account fails", async () => {
    mockPrismaClient.user.findUnique.mockResolvedValue(null);
    const result = await bootstrapProductionAdmin();
    expect(result).toBe(false); // Transaction aborts because mode is promote_existing but user not found
  });

  it("requires explicit create-new confirmation for create_new mode", async () => {
    process.env.PERX_ADMIN_BOOTSTRAP_MODE = "create_new";
    process.env.PERX_ADMIN_PASSWORD = "Password123!";
    // Missing PERX_ADMIN_CREATE_CONFIRM
    let result = await bootstrapProductionAdmin();
    expect(result).toBe(false);

    process.env.PERX_ADMIN_CREATE_CONFIRM = "I_CONFIRM_NEW_PRODUCTION_ADMIN_CREATION";
    mockPrismaClient.user.findUnique.mockResolvedValue(null);
    mockPrismaClient.user.create.mockResolvedValue({ id: "user_123", roles: [{ roleId: "role_admin" }] });
    result = await bootstrapProductionAdmin();
    expect(result).toBe(true);
  });

  it("promotes existing accounts, preserves password/profile, revokes sessions", async () => {
    mockPrismaClient.user.findUnique.mockResolvedValue({
      id: "user_123",
      email: "admin@example.com",
      roles: [],
    });

    mockPrismaClient.user.update.mockResolvedValueOnce({
      id: "user_123",
      email: "admin@example.com",
      roles: [],
    });

    const result = await bootstrapProductionAdmin();
    
    expect(result).toBe(true);
    expect(mockPrismaClient.user.create).not.toHaveBeenCalled();
    // Update should not include password modifications
    expect(mockPrismaClient.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { accountClassification: "INTERNAL_ADMIN" },
      })
    );
    expect(mockPrismaClient.userRole.create).toHaveBeenCalled();
    // Verify session revocation
    expect(mockPrismaClient.session.deleteMany).toHaveBeenCalledWith({ where: { userId: "user_123" } });
  });

  it("performs idempotent role assignment", async () => {
    mockPrismaClient.user.findUnique.mockResolvedValue({
      id: "user_123",
      email: "admin@example.com",
      roles: [{ roleId: "role_admin" }], // Already has role
    });

    mockPrismaClient.user.update.mockResolvedValueOnce({
      id: "user_123",
      email: "admin@example.com",
      roles: [{ roleId: "role_admin" }],
    });

    const result = await bootstrapProductionAdmin();
    
    expect(result).toBe(true);
    expect(mockPrismaClient.userRole.create).not.toHaveBeenCalled();
  });

  it("performs idempotent audit logging", async () => {
    mockPrismaClient.user.findUnique.mockResolvedValue({
      id: "user_123",
      email: "admin@example.com",
      roles: [{ roleId: "role_admin" }],
    });
    mockPrismaClient.user.update.mockResolvedValueOnce({
      id: "user_123",
      email: "admin@example.com",
      roles: [{ roleId: "role_admin" }],
    });

    // Simulate existing audit log
    mockPrismaClient.auditLog.findFirst.mockResolvedValue({ id: "audit_1" });

    const result = await bootstrapProductionAdmin();
    expect(result).toBe(true);
    // Should not create another audit log
    expect(mockPrismaClient.auditLog.create).not.toHaveBeenCalled();
  });

  it("handles transaction rollback", async () => {
    mockPrismaClient.user.findUnique.mockResolvedValue({
      id: "user_123",
      email: "admin@example.com",
      roles: [],
    });

    // Make update fail to simulate transaction failure
    mockPrismaClient.user.update.mockRejectedValue(new Error("DB Error"));

    const result = await bootstrapProductionAdmin();
    expect(result).toBe(false);
  });
});
