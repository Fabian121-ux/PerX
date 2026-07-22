import "dotenv/config";
import { getPrisma } from "../src/lib/db/prisma";

async function retireAutomatedAccount() {
  const email = process.env.PERX_RETIRE_EMAIL;

  if (!email) {
    console.error("Missing PERX_RETIRE_EMAIL environment variable.");
    process.exit(1);
  }

  const prisma = getPrisma();

  try {
      const user = await prisma.user.findUnique({
        where: { email },
        include: { roles: true },
      });

      if (!user) {
        console.info(`User with email ${email} not found. Nothing to retire.`);
        return;
      }

      console.info(`Found user ${user.id} (${user.email}). Retiring account...`);

      // 1. Set isActive=false and classification to SYSTEM_ACCOUNT
      await prisma.user.update({
        where: { id: user.id },
        data: {
          isActive: false,
          accountClassification: "SYSTEM_ACCOUNT",
        },
      });

      // 2. Revoke every active session
      const deletedSessions = await prisma.session.deleteMany({
        where: { userId: user.id },
      });
      console.info(`Revoked ${deletedSessions.count} active sessions.`);

      // 3. Remove ordinary role assignments where safe (MEMBER, etc.)
      const deletedRoles = await prisma.userRole.deleteMany({
        where: { userId: user.id },
      });
      console.info(`Removed ${deletedRoles.count} ordinary role assignments.`);

      // 4. Create an audit event explaining the retirement
      const existingAudit = await prisma.auditLog.findFirst({
        where: {
          action: "admin.retire_account",
          entityType: "user",
          entityId: user.id,
        },
      });

      if (!existingAudit) {
        await prisma.auditLog.create({
          data: {
            action: "admin.retire_account",
            entityType: "user",
            entityId: user.id,
            metadata: { reason: "Automated live-registration verification account retired" },
          },
        });
        console.info("Created audit log for retirement.");
      } else {
        console.info("Audit log for retirement already exists.");
      }

      console.info("Automated account successfully retired.");
  } catch (error) {
    console.error("Failed to retire automated account:", error);
    process.exit(1);
  }
}

if (require.main === module) {
  retireAutomatedAccount().then(() => process.exit(0));
}
