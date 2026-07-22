import "dotenv/config";
import { getRegistrationStatus } from "../src/lib/registration/status";

async function checkStatus() {
  const status = await getRegistrationStatus();
  console.log(JSON.stringify(status, null, 2));
}

checkStatus().catch(console.error);
