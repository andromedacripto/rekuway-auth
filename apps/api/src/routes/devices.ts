import type { FastifyInstance } from "fastify";
import { deviceIdParamSchema } from "@rekuway/shared";
import { requireSession } from "../lib/requireSession.js";
import { logSecurityEvent } from "../lib/securityEvents.js";

export function registerDeviceRoutes(app: FastifyInstance): void {
  app.get("/auth/devices", { preHandler: requireSession }, async (req, reply) => {
    const devices = await app.prisma.device.findMany({
      where: { userId: req.sessionUserId as string, revokedAt: null },
      orderBy: { lastSeenAt: "desc" },
    });
    return reply.send({ devices });
  });

  app.delete("/auth/devices/:id", { preHandler: requireSession }, async (req, reply) => {
    const parsed = deviceIdParamSchema.safeParse(req.params);
    if (!parsed.success) {
      return reply.status(400).send({ code: "VALIDATION_ERROR", message: "Invalid input." });
    }

    const result = await app.prisma.device.updateMany({
      where: { id: parsed.data.id, userId: req.sessionUserId as string, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    if (result.count === 0) {
      return reply.status(404).send({ code: "NOT_FOUND", message: "Device not found." });
    }

    await logSecurityEvent(
      app.prisma,
      { type: "SESSION_REVOKED", userId: req.sessionUserId },
      req.ip,
    );
    return reply.send({ revoked: true });
  });
}
