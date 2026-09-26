/** Supabase is the default. Legacy is an explicit operational rollback only. */
export function usesSupabaseAuth() {
  const provider = process.env.PERX_AUTH_PROVIDER ?? "supabase";
  if (provider !== "supabase" && provider !== "legacy")
    throw new Error("Invalid PERX_AUTH_PROVIDER.");
  return provider === "supabase";
}
