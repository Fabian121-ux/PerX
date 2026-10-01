import { getServerEnv } from "@/lib/env";
const loopback = new Set(["localhost", "127.0.0.1", "[::1]"]);
export function supabaseAuthConfig() {
  const env = getServerEnv();
  if (
    !env.NEXT_PUBLIC_SUPABASE_URL ||
    !env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  )
    throw new Error("Supabase Auth configuration is unavailable.");
  const provider = new URL(env.NEXT_PUBLIC_SUPABASE_URL);
  if (
    provider.username ||
    provider.password ||
    provider.search ||
    provider.hash ||
    provider.pathname !== "/" ||
    (provider.protocol !== "https:" &&
      !(provider.protocol === "http:" && loopback.has(provider.hostname)))
  )
    throw new Error(
      "Supabase Auth requires an HTTPS origin or an exact local loopback origin.",
    );
  return {
    url: env.NEXT_PUBLIC_SUPABASE_URL,
    key: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  };
}
/** Never derive emailed destinations from Host, Origin or submitted form fields. */
export function authEmailRedirect() {
  const provider = new URL(supabaseAuthConfig().url);
  const app = new URL(getServerEnv().NEXT_PUBLIC_APP_URL);
  if (
    app.username ||
    app.password ||
    app.search ||
    app.hash ||
    app.pathname !== "/"
  )
    throw new Error("Invalid application origin.");
  if (loopback.has(provider.hostname)) {
    if (
      !loopback.has(app.hostname) ||
      !["http:", "https:"].includes(app.protocol)
    )
      throw new Error("Local Auth requires a local application origin.");
  } else if (
    app.protocol !== "https:" ||
    loopback.has(app.hostname) ||
    app.hostname.endsWith(".localhost")
  )
    throw new Error("Remote Auth requires an HTTPS application origin.");
  return new URL("/auth/confirm", app).toString();
}
