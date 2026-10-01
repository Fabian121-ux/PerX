import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseAuthConfig } from "./supabase-config";
export async function refreshSupabaseSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  if (
    !request.cookies
      .getAll()
      .some(
        ({ name }) => name.startsWith("sb-") && name.includes("-auth-token"),
      )
  )
    return response;
  const { url, key } = supabaseAuthConfig();
  const client = createServerClient(url, key, {
    cookieOptions: {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure:
        process.env.NODE_ENV === "production" || process.env.VERCEL === "1",
    },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(values) {
        for (const { name, value } of values) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of values)
          response.cookies.set(name, value, options);
      },
    },
  });
  // Online validation, never the unverified user embedded in a cookie.
  await client.auth.getUser();
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  return response;
}
