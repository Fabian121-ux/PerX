"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { TEST_SESSION_COOKIE_NAME, TEST_SESSION_VALUE } from "@/lib/dev/test-auth";

export async function testLoginAction() {
  if (process.env.NODE_ENV !== "development") {
    throw new Error("Test login is only available in development mode.");
  }

  const cookieStore = await cookies();
  cookieStore.set(TEST_SESSION_COOKIE_NAME, TEST_SESSION_VALUE, {
    httpOnly: true,
    maxAge: 30 * 24 * 60 * 60,
    path: "/",
    sameSite: "lax",
    secure: false, // development only
  });

  redirect("/app");
}
