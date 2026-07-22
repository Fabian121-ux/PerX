import "dotenv/config";
import { getPrisma } from "../src/lib/db/prisma";

async function checkSessions() {
  const prisma = getPrisma();
  
  const user = await prisma.user.findUnique({
    where: { email: "dev-test@gmail.com" },
    include: { sessions: true }
  });

  if (!user) {
    console.error("User not found!");
    return;
  }

  console.log("Sessions count:", user.sessions.length);
  if (user.sessions.length > 0) {
    console.log("Latest session created at:", user.sessions[0].createdAt);
  }
}

checkSessions().then(() => process.exit(0)).catch(console.error);
