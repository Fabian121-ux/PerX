import { loadTestEnv } from "./load-test-env";

// Loads `.env.test.local` (git-ignored) before any test module is imported,
// so DB-backed suites resolve the isolated loopback database instead of
// requiring a manual export. `.env` is never loaded here: it holds
// Production credentials, and the DB guard rejects them by fingerprint.
loadTestEnv();
