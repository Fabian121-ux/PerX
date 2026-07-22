import "dotenv/config";
import readline from "node:readline";
import { getPrisma } from "../src/lib/db/prisma";
import { hashPassword } from "../src/lib/auth/password";

function logError(message: string) {
  console.error(`[ERROR] ${message}`);
}

function logInfo(message: string) {
  console.info(`[INFO] ${message}`);
}

async function promptPassword(): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    let result = "";
    
    // Simple masked input implementation
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.setEncoding("utf8");
      
      const onData = (c: string) => {
        switch (c) {
          case "\n":
          case "\r":
          case "\u0004":
            process.stdin.removeListener("data", onData);
            process.stdin.setRawMode(false);
            process.stdin.pause();
            process.stdout.write("\n");
            resolve(result);
            break;
          case "\u0003": // Ctrl+C
            process.stdin.removeListener("data", onData);
            process.stdin.setRawMode(false);
            process.stdin.pause();
            process.exit(1);
            break;
          case "\b": // Backspace
          case "\x7f":
            if (result.length > 0) {
              result = result.slice(0, -1);
              process.stdout.write("\b \b");
            }
            break;
          default:
            if (c.charCodeAt(0) >= 32 && c.charCodeAt(0) !== 127) {
              result += c;
              process.stdout.write("*");
            }
            break;
        }
      };
      
      process.stdout.write("Enter new Production Admin Password: ");
      process.stdin.on("data", onData);
    } else {
      // Fallback for non-TTY (like tests or piped input)
      rl.question("Enter new Production Admin Password: ", (password) => {
        rl.close();
        resolve(password);
      });
    }
  });
}

export async function bootstrapProductionAdmin() {
  const allowBootstrap = process.env.PERX_ALLOW_PRODUCTION_ADMIN_BOOTSTRAP === "true";
  const confirmBootstrap = process.env.PERX_ADMIN_BOOTSTRAP_CONFIRM === "CREATE_PERX_PRODUCTION_ADMIN";
  const deployEnv = process.env.PERX_DEPLOY_ENV === "production";
  const dbLabel = process.env.PERX_DATABASE_LABEL === "perx-production";
  const fingerprint = process.env.PERX_PRODUCTION_DATABASE_FINGERPRINT;

  if (!allowBootstrap || !confirmBootstrap) {
    logError("Missing required explicit confirmation flags.");
    return false;
  }

  if (!deployEnv) {
    logError("PERX_DEPLOY_ENV must be production.");
    return false;
  }

  if (!dbLabel) {
    logError("PERX_DATABASE_LABEL must be perx-production.");
    return false;
  }

  if (!fingerprint) {
    logError("PERX_PRODUCTION_DATABASE_FINGERPRINT is missing.");
    return false;
  }

  const mode = process.env.PERX_ADMIN_BOOTSTRAP_MODE || "promote_existing";
  if (mode !== "promote_existing" && mode !== "create_new") {
    logError("PERX_ADMIN_BOOTSTRAP_MODE must be promote_existing or create_new.");
    return false;
  }

  const email = process.env.PERX_ADMIN_EMAIL;
  const username = process.env.PERX_ADMIN_USERNAME;
  const fullName = process.env.PERX_ADMIN_FULL_NAME;

  if (!email || !username || !fullName) {
    logError("Missing required administrator account details (email, username, full name).");
    return false;
  }

  if (mode === "create_new") {
    const createConfirm = process.env.PERX_ADMIN_CREATE_CONFIRM;
    if (createConfirm !== "I_CONFIRM_NEW_PRODUCTION_ADMIN_CREATION") {
      logError("New-account creation requires PERX_ADMIN_CREATE_CONFIRM=I_CONFIRM_NEW_PRODUCTION_ADMIN_CREATION.");
      return false;
    }
  }

  const prisma = getPrisma();

  try {
    await prisma.$executeRaw`SELECT 1`;
  } catch {
    logError("Database connectivity check failed.");
    return false;
  }

  try {
    const migrations: { migration_name: string }[] = await prisma.$queryRaw`SELECT migration_name FROM _prisma_migrations WHERE migration_name LIKE '%0002_open_beta_registration%' AND finished_at IS NOT NULL`;
    if (!migrations || migrations.length === 0) {
      logError("Migration 0002_open_beta_registration is not applied. Script refuses to run.");
      return false;
    }
  } catch {
    logError("Failed to check migration status. Script refuses to run.");
    return false;
  }

  try {
    const classifications: { value: string }[] = await prisma.$queryRaw`
      SELECT unnest(enum_range(NULL::"AccountClassification"))::text AS value
    `;
    if (!classifications.some(c => c.value === 'INTERNAL_ADMIN' || c.value === 'PUBLIC_BETA_USER')) {
      logError("Required account classification structure does not exist.");
      return false;
    }
  } catch {
    logError("Failed to check account classification structure.");
    return false;
  }

  let password = process.env.PERX_ADMIN_PASSWORD;
  if (mode === "create_new" && !password) {
    password = await promptPassword();
  }

  try {
    await prisma.$transaction(async (tx) => {
      let user = await tx.user.findUnique({
        where: { email },
        include: { roles: true },
      });

      const adminRole = await tx.role.upsert({
        create: {
          description: "Full administrative access.",
          label: "Admin",
          name: "ADMIN",
        },
        update: {},
        where: { name: "ADMIN" },
      });

      const memberRole = await tx.role.upsert({
        create: {
          description: "Standard user access.",
          label: "Member",
          name: "MEMBER",
        },
        update: {},
        where: { name: "MEMBER" },
      });

      const internalTesterRole = await tx.role.upsert({
        create: {
          description: "Internal beta tester access.",
          label: "Internal Tester",
          name: "INTERNAL_TESTER",
        },
        update: {},
        where: { name: "INTERNAL_TESTER" },
      });

      if (user) {
        logInfo("User found with matching email. Promoting to production administrator.");
        
        user = await tx.user.update({
          where: { email },
          data: {
            accountClassification: "INTERNAL_ADMIN",
          },
          include: { roles: true },
        });

        const hasAdminRole = user.roles.some((r) => r.roleId === adminRole.id);
        if (!hasAdminRole) {
          await tx.userRole.create({
            data: {
              roleId: adminRole.id,
              userId: user.id,
            },
          });
        }
        
        const hasMemberRole = user.roles.some((r) => r.roleId === memberRole.id);
        if (!hasMemberRole) {
          await tx.userRole.create({
            data: {
              roleId: memberRole.id,
              userId: user.id,
            },
          });
        }
        
        const hasInternalTesterRole = user.roles.some((r) => r.roleId === internalTesterRole.id);
        if (!hasInternalTesterRole) {
          await tx.userRole.create({
            data: {
              roleId: internalTesterRole.id,
              userId: user.id,
            },
          });
        }
        
        // Revoke existing sessions
        await tx.session.deleteMany({
          where: { userId: user.id }
        });
      } else {
        if (mode === "promote_existing") {
           throw new Error("Missing existing account for promotion. Aborting.");
        }
        logInfo("Creating new production administrator account.");
        
        if (!password) throw new Error("Password is required for new account creation.");
        const passwordHash = await hashPassword(password);
        user = await tx.user.create({
          data: {
            accountClassification: "INTERNAL_ADMIN",
            email,
            name: fullName,
            passwordHash,
            username,
            isActive: true,
            profile: {
              create: {
                biography: "Platform Administrator",
                headline: "System Administrator",
                location: "Internal",
                profileCompleteness: 100,
              },
            },
            roles: {
              create: [{ roleId: adminRole.id }, { roleId: memberRole.id }, { roleId: internalTesterRole.id }],
            },
          },
          include: { roles: true },
        });
      }

      // Idempotent audit logging
      const existingAudit = await tx.auditLog.findFirst({
        where: {
          action: "admin.bootstrap",
          entityType: "user",
          entityId: user.id,
        }
      });

      if (!existingAudit) {
        await tx.auditLog.create({
          data: {
            action: "admin.bootstrap",
            entityType: "user",
            entityId: user.id,
            actorId: user.id,
            metadata: { promoted: !!user },
          },
        });
      }
    }, { maxWait: 10000, timeout: 30000 });

    logInfo("Bootstrap completed successfully.");
    return true;
  } catch (error) {
    logError(`Transaction failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    return false;
  }
}

// Execute if run directly
if (require.main === module) {
  bootstrapProductionAdmin()
    .then((success) => {
      if (!success) process.exit(1);
      process.exit(0);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
