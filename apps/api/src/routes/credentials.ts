import type { FastifyInstance } from "fastify";
import { credentialIdParamSchema } from "@rekuway/shared";
import { requireSession } from "../lib/requireSession.js";
import { logSecurityEvent } from "../lib/securityEvents.js";

export function registerCredentialRoutes(app: FastifyInstance): void {
  app.get("/auth/credentials", { preHandler: requireSession }, async (req, reply) => {
    const credentials = await app.prisma.webAuthnCredential.findMany({
      where: { userId: req.sessionUserId as string, revokedAt: null },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        credentialId: true,
        deviceType: true,
        backedUp: true,
        transports: true,
        createdAt: true,
        // publicKey and counter are internal — never exposed to clients.
      },
    });
    return reply.send({ credentials });
  });

  app.delete("/auth/credentials/:id", { preHandler: requireSession }, async (req, reply) => {
    const parsed = credentialIdParamSchema.safeParse(req.params);
    if (!parsed.success) {
      return reply.status(400).send({ code: "VALIDATION_ERROR", message: "Invalid input." });
    }

    const result = await app.prisma.webAuthnCredential.updateMany({
      where: { id: parsed.data.id, userId: req.sessionUserId as string, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    if (result.count === 0) {
      return reply.status(404).send({ code: "NOT_FOUND", message: "Credential not found." });
    }

    await logSecurityEvent(
      app.prisma,
      { type: "CREDENTIAL_REVOKED", userId: req.sessionUserId },
      req.ip,
    );
    return reply.send({ revoked: true });
  });
}
