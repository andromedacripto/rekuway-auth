import { Redis } from "ioredis";
import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import type { Env } from "@rekuway/config";

declare module "fastify" {
  interface FastifyInstance {
    redis: Redis;
  }
}

// Redis holds ONLY temporary data: challenges, intermediate nonces, rate
// limit counters, session cache (spec section 17). PostgreSQL remains the
// permanent store. The client is a thin wrapper so swapping Upstash for
// another redis-protocol-compatible provider later requires no app changes.
export const redisPlugin = fp((app: FastifyInstance, opts: { env: Env }, done: (err?: Error) => void) => {
  const redis = new Redis(opts.env.REDIS_URL, {
    maxRetriesPerRequest: 3,
    lazyConnect: false,
  });

  redis.on("error", (err: Error) => {
    app.log.error({ err: err.message }, "redis error");
  });

  app.decorate("redis", redis);

  app.addHook("onClose", async (instance) => {
    await instance.redis.quit();
  });

  done();
});
