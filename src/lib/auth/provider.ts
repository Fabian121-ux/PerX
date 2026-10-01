/** Keep deployed legacy auth until Supabase cutover is explicitly configured. */
export function usesSupabaseAuth() {
  const provider = process.env.PERX_AUTH_PROVIDER ?? "legacy";
  if (provider !== "supabase" && provider !== "legacy")
    throw new Error("Invalid PERX_AUTH_PROVIDER.");
  return provider === "supabase";
}
