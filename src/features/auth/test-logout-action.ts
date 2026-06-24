"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { TEST_SESSION_COOKIE_NAME } from "@/lib/dev/test-auth";

export async function testLogoutAction() {
  if (process.env.NODE_ENV !== "development") {
    throw new Error("Test logout is only available in development mode.");
  }

  const cookieStore = await cookies();
  cookieStore.delete(TEST_SESSION_COOKIE_NAME);

  redirect("/sign-in");
}
