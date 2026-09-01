import { z } from "zod";

// Spec section 47: validate environment variables with Zod at startup.
// If a required variable is missing, fail immediately with a SAFE message
// (never echo back the actual secret value, even a partial one).

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().min(1),

  RP_ID: z.string().min(1),
  RP_NAME: z.string().min(1),
  ORIGIN: z.string().url(),

  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters"),

  CORS_ORIGINS: z.string().min(1),
});

export type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | null = null;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  if (cachedEnv) return cachedEnv;

  const result = envSchema.safeParse(source);

  if (!result.success) {
    const missing = result.error.issues.map((issue) => issue.path.join(".")).join(", ");
    // Safe message: names the missing/invalid keys, never their values.
    console.error(`[config] Invalid environment configuration. Problem keys: ${missing}`);
    // Intentional fail-fast on invalid startup config, per spec section 47
    // ("falhar imediatamente com mensagem segura"). This is server startup
    // code, not library code, so exiting the process is the correct action.
    // eslint-disable-next-line unicorn/no-process-exit
    process.exit(1);
  }

  cachedEnv = result.data;
  return cachedEnv;
}

export function getCorsOrigins(env: Env): string[] {
  return env.CORS_ORIGINS.split(",").map((origin) => origin.trim()).filter(Boolean);
}
