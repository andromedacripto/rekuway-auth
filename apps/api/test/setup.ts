import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { beforeAll, afterAll } from "vitest";

// Ensures NODE_ENV=test and a valid config are present before any test
// file imports the app. Tests expect DATABASE_URL/REDIS_URL to point at a
// disposable test database (see .github/workflows/ci.yml for the CI setup,
// or run `docker compose up -d` + a local `rekuway_auth_test` DB for local
// runs).
//
// IMPORTANT: unlike the Prisma CLI or `tsx`, Vitest does NOT auto-load a
// .env file. Without loading it explicitly here, a locally password-protected
// Redis (as configured in docker-compose.yml) silently falls back to the
// unauthenticated default below and every Redis call fails with NOAUTH.
// process.loadEnvFile is available on Node 20.6+/22+ — load it best-effort;
// in CI there is no .env file (env vars are injected by the workflow
// directly), so a missing file here is expected and safely ignored.
try {
  process.loadEnvFile(fileURLToPath(new URL("../.env", import.meta.url)));
} catch {
  // No local .env — fine in CI, where env vars come from the workflow.
}

process.env.NODE_ENV = "test";
process.env.RP_ID ??= "localhost";
process.env.RP_NAME ??= "Rekuway Auth Test";
process.env.ORIGIN ??= "http://localhost:3000";
process.env.SESSION_SECRET ??= "test-session-secret-at-least-32-characters-long";
process.env.CORS_ORIGINS ??= "http://localhost:3000";
process.env.DATABASE_URL ??= "postgresql://rekuway:rekuway@localhost:5432/rekuway_auth_test";
process.env.REDIS_URL ??= "redis://localhost:6379";

// Locally, DATABASE_URL from .env points at the regular dev database
// (rekuway_auth) — tests must always run against the disposable test
// database instead, regardless of what .env says.
process.env.DATABASE_URL = "postgresql://rekuway:rekuway@localhost:5432/rekuway_auth_test";

beforeAll(() => {
  try {
    execSync("pnpm exec prisma migrate deploy", {
      cwd: new URL("..", import.meta.url).pathname,
      stdio: "inherit",
      env: process.env,
    });
  } catch {
    // If migrations are already applied (common in CI reruns) this can be
    // safely ignored; a genuinely broken schema will fail the tests below.
  }
});

afterAll(() => {
  // Individual test files are responsible for cleaning up the rows they
  // create, since they use randomly generated emails to avoid collisions.
});
