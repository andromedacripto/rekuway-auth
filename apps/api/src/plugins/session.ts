import cookie from "@fastify/cookie";
import fp from "fastify-plugin";
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { Env } from "@rekuway/config";

export const SESSION_COOKIE_NAME = "rekuway_session";

declare module "fastify" {
  interface FastifyRequest {
    /** Populated by requireSession() — never trust a cookie value directly. */
    sessionUserId?: string;
    sessionId?: string;
  }
}

// Spec section 24: server-side sessions, not JWT. The cookie only carries an
// opaque, unguessable session ID; all actual session state lives in
// PostgreSQL + a Redis cache, and is looked up per request.
export const sessionPlugin = fp(async (app: FastifyInstance, opts: { env: Env }) => {
  await app.register(cookie, {
    secret: opts.env.SESSION_SECRET, // signs the cookie to detect tampering
    hook: "onRequest",
    parseOptions: {
      httpOnly: true,
      secure: opts.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
    },
  });
});

export function readSessionCookie(req: FastifyRequest): string | null {
  // Key is the fixed local constant SESSION_COOKIE_NAME, never user input.
  // eslint-disable-next-line security/detect-object-injection
  const raw = req.cookies[SESSION_COOKIE_NAME];
  if (!raw) return null;
  const unsigned = req.unsignCookie(raw);
  if (!unsigned.valid || !unsigned.value) return null;
  return unsigned.value;
}
