import type { FastifyInstance } from "fastify";
import { requireSession } from "../lib/requireSession.js";
import { SessionManager } from "../lib/sessionManager.js";
import { logSecurityEvent } from "../lib/securityEvents.js";
import { SESSION_COOKIE_NAME } from "../plugins/session.js";
import type { Env } from "@rekuway/config";

export function registerAuthLogoutRoutes(app: FastifyInstance, env: Env): void {
  app.post("/auth/logout", { preHandler: requireSession }, async (req, reply) => {
    const sessionManager = new SessionManager(app.prisma, app.redis);
    await sessionManager.revoke(req.sessionId as string);
    await logSecurityEvent(app.prisma, { type: "LOGOUT", userId: req.sessionUserId }, req.ip);

    void reply.clearCookie(SESSION_COOKIE_NAME, {
      path: "/",
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "strict",
    });

    return reply.send({ loggedOut: true });
  });

  app.get("/auth/session", { preHandler: requireSession }, async (req, reply) => {
    const user = await app.prisma.user.findUnique({ where: { id: req.sessionUserId } });
    return reply.send({ userId: req.sessionUserId, email: user?.email });
  });
}
