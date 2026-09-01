import type { FastifyInstance } from "fastify";
import { sessionIdParamSchema } from "@rekuway/shared";
import { requireSession } from "../lib/requireSession.js";
import { SessionManager } from "../lib/sessionManager.js";
import { logSecurityEvent } from "../lib/securityEvents.js";

export function registerSessionRoutes(app: FastifyInstance): void {
  app.get("/auth/sessions", { preHandler: requireSession }, async (req, reply) => {
    const sessions = await app.prisma.session.findMany({
      where: { userId: req.sessionUserId as string, revokedAt: null },
      orderBy: { createdAt: "desc" },
      select: { id: true, createdAt: true, expiresAt: true, deviceId: true },
    });

    return reply.send({
      sessions: sessions.map(
        (s: { id: string; createdAt: Date; expiresAt: Date; deviceId: string | null }) => ({
          ...s,
          current: s.id === req.sessionId,
        }),
      ),
    });
  });

  app.delete("/auth/sessions/:id", { preHandler: requireSession }, async (req, reply) => {
    const parsed = sessionIdParamSchema.safeParse(req.params);
    if (!parsed.success) {
      return reply.status(400).send({ code: "VALIDATION_ERROR", message: "Invalid input." });
    }

    const owned = await app.prisma.session.findFirst({
      where: { id: parsed.data.id, userId: req.sessionUserId as string },
    });
    if (!owned) {
      return reply.status(404).send({ code: "NOT_FOUND", message: "Session not found." });
    }

    const sessionManager = new SessionManager(app.prisma, app.redis);
    await sessionManager.revoke(parsed.data.id);
    await logSecurityEvent(
      app.prisma,
      { type: "SESSION_REVOKED", userId: req.sessionUserId },
      req.ip,
    );

    return reply.send({ revoked: true });
  });
}
