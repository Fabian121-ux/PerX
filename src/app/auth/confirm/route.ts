import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { unstable_rethrow } from "next/navigation";
import {
  createSupabaseServerClient,
  clearSupabaseSession,
  RECOVERY_COOKIE,
} from "@/lib/auth/supabase-server";
import { authEmailRedirect } from "@/lib/auth/supabase-config";
import { usesSupabaseAuth } from "@/lib/auth/provider";
import { getPrisma } from "@/lib/db/prisma";
import { createSession } from "@/lib/auth/session";
import { evaluateAccountAccess } from "@/lib/account/enforcement";
import { issuePasswordResetToken } from "@/lib/auth/password-reset";
import { getSafeAuthRedirect } from "@/lib/auth/redirects";
import { logServerDataError } from "@/lib/logging/runtime";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const token = params.get("token_hash"),
    type = params.get("type");
  function go(path: string) {
    const response = NextResponse.redirect(new URL(path, authEmailRedirect()));
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  }
  if (
    !usesSupabaseAuth() ||
    !token ||
    token.length > 512 ||
    !["signup", "email", "recovery", "invite"].includes(type ?? "")
  )
    return go("/sign-in?confirmation=invalid");
  try {
    const client = await createSupabaseServerClient(true);
    const { data, error } = await client.auth.verifyOtp({
      token_hash: token,
      type: type as "signup" | "email" | "recovery" | "invite",
    });
    if (error || !data.user?.email_confirmed_at || !data.session)
      return go("/sign-in?confirmation=invalid");
    const user = await getPrisma().user.findUnique({
      where: { authUserId: data.user.id },
    });
    if (!user || !evaluateAccountAccess(user).canAuthenticate) {
      await clearSupabaseSession();
      return go("/sign-in?confirmation=unavailable");
    }
    await getPrisma().user.update({
      where: { id: user.id },
      data: { emailVerifiedAt: new Date(data.user.email_confirmed_at) },
    });
    if (type === "recovery" || type === "invite") {
      const grant = await issuePasswordResetToken({ userId: user.id });
      (await cookies()).set(RECOVERY_COOKIE, grant.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        expires: grant.expiresAt,
      });
      return go("/reset-password");
    }
    await createSession(user.id);
    return go(getSafeAuthRedirect(params.get("next"), "/app/profile/setup"));
  } catch (error) {
    unstable_rethrow(error);
    logServerDataError({
      error,
      operation: "auth.supabase.confirm",
      route: "/auth/confirm",
    });
    return go("/sign-in?confirmation=invalid");
  }
}
