import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";
import { supabaseAuthConfig } from "./supabase-config";
export const RECOVERY_COOKIE = "ptahx_recovery";
export async function createSupabaseServerClient(writable = false) {
  const store = await cookies();
  const { url, key } = supabaseAuthConfig();
  return createServerClient(url, key, {
    cookieOptions: {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure:
        process.env.NODE_ENV === "production" || process.env.VERCEL === "1",
    },
    cookies: {
      getAll: () => store.getAll(),
      setAll(values) {
        // Proxy refreshes cookies before Server Component rendering. Actions and routes can write.
        if (writable)
          for (const { name, value, options } of values)
            store.set(name, value, options);
      },
    },
  });
}
export const getVerifiedSupabaseIdentity = cache(async () => {
  const client = await createSupabaseServerClient();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user?.email_confirmed_at) return null;
  return data.user;
});
export async function clearSupabaseSession() {
  const store = await cookies();
  try {
    const client = await createSupabaseServerClient(true);
    await client.auth.signOut({ scope: "local" });
  } finally {
    // Clear even if the provider cannot be reached; PtahX's revocation record is deleted first.
    for (const { name } of store.getAll())
      if (name.startsWith("sb-") && name.includes("-auth-token"))
        store.set(name, "", {
          maxAge: 0,
          httpOnly: true,
          path: "/",
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
        });
    store.set(RECOVERY_COOKIE, "", {
      maxAge: 0,
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
  }
}
