import { existsSync } from "node:fs";
import path from "node:path";

import dotenv from "dotenv";

/**
 * Loads local test environment variables for Vitest and Playwright.
 *
 * Test runners intentionally do NOT load `.env`, because `.env` holds
 * Production credentials. Local test configuration lives in
 * `.env.test.local` (git-ignored via `.env*`), which should point at the
 * isolated loopback database, e.g.
 *
 *   TEST_DATABASE_URL="postgresql://postgres:password@127.0.0.1:55434/perx_test?schema=public"
 *
 * dotenv does not override variables already present in `process.env`, so an
 * explicit shell export still wins. That is deliberate: CI supplies values
 * directly, and the database guard remains the single authority that
 * fails closed on any non-loopback or Production-fingerprinted URL.
 */
export function loadTestEnv(rootDir = process.cwd()) {
  for (const file of [".env.test.local", ".env.test"]) {
    const candidate = path.resolve(rootDir, file);
    if (existsSync(candidate)) {
      dotenv.config({ path: candidate, quiet: true });
    }
  }

  // Local Supabase placeholders: never Production values.
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= "http://127.0.0.1:54321";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??=
    "local-test-publishable-key";
}
