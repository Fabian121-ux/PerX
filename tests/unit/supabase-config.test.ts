import { afterEach, beforeEach, expect, it, vi } from "vitest";
const env = vi.hoisted(() => ({
  NEXT_PUBLIC_SUPABASE_URL: "https://provider.example.test",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "public-test",
  NEXT_PUBLIC_APP_URL: "https://app.example.test",
}));
vi.mock("@/lib/env", () => ({ getServerEnv: () => env }));
import {
  authEmailRedirect,
  supabaseAuthConfig,
} from "@/lib/auth/supabase-config";
import { usesSupabaseAuth } from "@/lib/auth/provider";
beforeEach(() => {
  env.NEXT_PUBLIC_SUPABASE_URL = "https://provider.example.test";
  env.NEXT_PUBLIC_APP_URL = "https://app.example.test";
});
afterEach(() => vi.unstubAllEnvs());
it.each(["development", "test", "production"])(
  "keeps legacy auth when the provider setting is absent in %s",
  (environment) => {
    vi.stubEnv("NODE_ENV", environment);
    vi.stubEnv("PERX_AUTH_PROVIDER", undefined);
    // Existing Supabase URL/key configuration must not imply an auth cutover.
    expect(usesSupabaseAuth()).toBe(false);
  },
);
it.each([
  ["legacy", false],
  ["supabase", true],
] as const)("honors explicit provider %s", (provider, expected) => {
  vi.stubEnv("PERX_AUTH_PROVIDER", provider);
  expect(usesSupabaseAuth()).toBe(expected);
});
it.each(["", "typo", "SUPABASE", " supabase "])(
  "rejects invalid provider setting %j instead of silently choosing a provider",
  (provider) => {
    vi.stubEnv("PERX_AUTH_PROVIDER", provider);
    expect(() => usesSupabaseAuth()).toThrow("Invalid PERX_AUTH_PROVIDER.");
  },
);
it.each([
  "http://localhost:3100",
  "http://127.0.0.1:3100",
  "https://[::1]",
  "http://app.example.test",
  "https://user:password@app.example.test",
  "https://app.example.test/extra",
  "https://app.example.test?next=evil",
])("does not send remote recovery mail to unsafe origin %s", (origin) => {
  env.NEXT_PUBLIC_APP_URL = origin;
  expect(() => authEmailRedirect()).toThrow();
});
it("allows local redirects only with local Auth", () => {
  env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:55441";
  env.NEXT_PUBLIC_APP_URL = "http://127.0.0.1:3100";
  expect(authEmailRedirect()).toBe("http://127.0.0.1:3100/auth/confirm");
});
it("uses configured trusted HTTPS origin", () => {
  expect(authEmailRedirect()).toBe("https://app.example.test/auth/confirm");
});

it.each([
  "http://provider.example.test",
  "ftp://provider.example.test",
  "https://user:password@provider.example.test",
  "https://provider.example.test?token=unsafe",
])("rejects an unsafe provider origin %s before sending credentials", (url) => {
  env.NEXT_PUBLIC_SUPABASE_URL = url;
  expect(() => supabaseAuthConfig()).toThrow();
});
