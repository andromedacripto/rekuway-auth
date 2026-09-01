import type { Redis } from "ioredis";

// Fixed-window counter in Redis. Simple, auditable, sufficient for MVP scale.
// Used for per-user and per-touch-sequence limits, distinct from the global
// per-IP limit enforced by @fastify/rate-limit (spec section 26).
export async function checkAndIncrement(
  redis: Redis,
  key: string,
  max: number,
  windowSeconds: number,
): Promise<{ allowed: boolean; remaining: number }> {
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, windowSeconds);
  }
  const allowed = count <= max;
  return { allowed, remaining: Math.max(0, max - count) };
}
