import type { FastifyInstance } from "fastify";

// Spec section 48: separate liveness vs readiness, never leak internal
// details (no stack traces, no connection strings, no version info tied to
// vulnerabilities) in these public, unauthenticated endpoints.
export function registerHealthRoutes(app: FastifyInstance): void {
  app.get("/health", async (_req, reply) => {
    return reply.send({ status: "ok" });
  });

  app.get("/ready", async (_req, reply) => {
    try {
      await app.prisma.$queryRaw`SELECT 1`;
      await app.redis.ping();
      return reply.send({ status: "ready" });
    } catch {
      return reply.status(503).send({ status: "not_ready" });
    }
  });
}
