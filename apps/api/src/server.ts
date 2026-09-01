import Fastify, { type FastifyInstance } from "fastify";
import { loadEnv, getCorsOrigins, type Env } from "@rekuway/config";
import { prismaPlugin } from "./plugins/prisma.js";
import { redisPlugin } from "./plugins/redis.js";
import { corsPlugin } from "./plugins/cors.js";
import { helmetPlugin } from "./plugins/helmet.js";
import { rateLimitPlugin } from "./plugins/rateLimit.js";
import { sessionPlugin } from "./plugins/session.js";
import { registerAuthRegisterRoutes } from "./routes/auth.register.js";
import { registerAuthLoginRoutes } from "./routes/auth.login.js";
import { registerAuthLogoutRoutes } from "./routes/auth.logout.js";
import { registerDeviceRoutes } from "./routes/devices.js";
import { registerCredentialRoutes } from "./routes/credentials.js";
import { registerSessionRoutes } from "./routes/sessions.js";
import { registerSecurityEventRoutes } from "./routes/securityEvents.js";
import { registerHealthRoutes } from "./routes/health.js";

export async function buildServer(envOverride?: Env): Promise<FastifyInstance> {
  const env = envOverride ?? loadEnv();

  const app = Fastify({
    logger: {
      level: env.NODE_ENV === "production" ? "info" : "debug",
      // Redact anything that could carry secrets/PII if it ever ends up in
      // a log line (spec section 31).
      redact: {
        paths: [
          "req.headers.authorization",
          "req.headers.cookie",
          "req.body.credential",
          "req.body.sequence",
        ],
        remove: true,
      },
    },
    trustProxy: true, // required for correct req.ip behind Vercel/Railway/etc.
    bodyLimit: 1_048_576, // 1MB — generous for WebAuthn payloads, blocks abuse
  });

  await app.register(prismaPlugin);
  await app.register(redisPlugin, { env });
  await app.register(corsPlugin, { allowedOrigins: getCorsOrigins(env) });
  await app.register(helmetPlugin);
  await app.register(rateLimitPlugin, { redis: app.redis });
  await app.register(sessionPlugin, { env });

  registerHealthRoutes(app);
  registerAuthRegisterRoutes(app, env);
  registerAuthLoginRoutes(app, env);
  registerAuthLogoutRoutes(app, env);
  registerDeviceRoutes(app);
  registerCredentialRoutes(app);
  registerSessionRoutes(app);
  registerSecurityEventRoutes(app);

  app.setErrorHandler((error, req, reply) => {
    // Never leak stack traces or internal error details to the client.
    req.log.error({ err: error.message }, "unhandled error");
    const statusCode = error.statusCode ?? 500;
    void reply.status(statusCode).send({
      code: statusCode === 500 ? "INTERNAL_ERROR" : "VALIDATION_ERROR",
      message: statusCode === 500 ? "Something went wrong." : error.message,
    });
  });

  return app;
}
