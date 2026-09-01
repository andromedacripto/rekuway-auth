import type { FastifyInstance } from "fastify";
import { requireSession } from "../lib/requireSession.js";

export function registerSecurityEventRoutes(app: FastifyInstance): void {
  app.get("/security/events", { preHandler: requireSession }, async (req, reply) => {
    const events = await app.prisma.securityEvent.findMany({
      where: { userId: req.sessionUserId as string },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, eventType: true, metadata: true, createdAt: true },
      // ipHash intentionally excluded from the client-facing response.
    });
    return reply.send({ events });
  });
}
