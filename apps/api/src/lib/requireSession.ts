import type { FastifyReply, FastifyRequest } from "fastify";
import { readSessionCookie } from "../plugins/session.js";
import { SessionManager } from "./sessionManager.js";

export async function requireSession(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const sessionId = readSessionCookie(req);
  if (!sessionId) {
    await reply.status(401).send({ code: "SESSION_INVALID", message: "Not authenticated." });
    return;
  }

  const sessionManager = new SessionManager(req.server.prisma, req.server.redis);
  const userId = await sessionManager.resolve(sessionId);
  if (!userId) {
    await reply.status(401).send({ code: "SESSION_INVALID", message: "Not authenticated." });
    return;
  }

  req.sessionId = sessionId;
  req.sessionUserId = userId;
}
