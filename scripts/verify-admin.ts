import "dotenv/config";
import { getPrisma } from "../src/lib/db/prisma";

async function verifyAdmin() {
  const prisma = getPrisma();
  
  const user = await prisma.user.findUnique({
    where: { email: "dev-test@gmail.com" },
    include: { roles: { include: { role: true } } }
  });

  if (!user) {
    console.error("User not found!");
    return;
  }

  console.log("Account Classification:", user.accountClassification);
  console.log("Roles assigned:");
  user.roles.forEach(r => console.log(`- ${r.role.name}`));
}

verifyAdmin().then(() => process.exit(0)).catch(console.error);
