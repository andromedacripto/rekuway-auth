import { describe, it, expect, afterAll } from "vitest";
import Redis from "ioredis";
import { checkAndIncrement } from "../src/lib/rateLimiter.js";

const redis = new Redis(process.env.REDIS_URL as string);

describe("checkAndIncrement (rate limiter)", () => {
  afterAll(async () => {
    await redis.quit();
  });

  it("allows requests under the limit and denies once exceeded", async () => {
    const key = `ratelimit:test:${Date.now()}`;

    const r1 = await checkAndIncrement(redis, key, 3, 60);
    const r2 = await checkAndIncrement(redis, key, 3, 60);
    const r3 = await checkAndIncrement(redis, key, 3, 60);
    const r4 = await checkAndIncrement(redis, key, 3, 60);

    expect(r1.allowed).toBe(true);
    expect(r2.allowed).toBe(true);
    expect(r3.allowed).toBe(true);
    expect(r4.allowed).toBe(false);
  });

  it("tracks independent counters per key", async () => {
    const keyA = `ratelimit:test-a:${Date.now()}`;
    const keyB = `ratelimit:test-b:${Date.now()}`;

    await checkAndIncrement(redis, keyA, 1, 60);
    const resultB = await checkAndIncrement(redis, keyB, 1, 60);

    expect(resultB.allowed).toBe(true);
  });
});
