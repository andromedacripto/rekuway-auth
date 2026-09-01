import rateLimit from "@fastify/rate-limit";
import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import type { Redis } from "ioredis";
import { RATE_LIMITS } from "@rekuway/security";

// Spec section 26: rate limiting by IP at the transport layer. Per-user and
// per-endpoint (touch sequence) limits are enforced explicitly inside route
// handlers via lib/rateLimiter.ts, backed by Redis, so that an attacker
// cannot lock out a victim just by spamming from many IPs against a single
// account (a global per-IP limit alone would not catch that).
export const rateLimitPlugin = fp(async (app: FastifyInstance, opts: { redis: Redis }) => {
  await app.register(rateLimit, {
    global: true,
    max: RATE_LIMITS.perIp.max,
    timeWindow: RATE_LIMITS.perIp.windowSeconds * 1000,
    redis: opts.redis,
    keyGenerator: (req) => req.ip,
    addHeadersOnExceeding: { "x-ratelimit-limit": true, "x-ratelimit-remaining": true },
    addHeaders: { "x-ratelimit-limit": true, "x-ratelimit-remaining": true },
  });
});
