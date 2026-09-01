import helmet from "@fastify/helmet";
import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";

// Spec section 30: security headers, evaluated deliberately rather than
// copy-pasted blindly.
export const helmetPlugin = fp(async (app: FastifyInstance) => {
  await app.register(helmet, {
    // This is a JSON API (the web app is a separate Next.js origin), so a
    // strict default-src 'none' CSP is appropriate here.
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
    hsts: {
      maxAge: 15552000, // 180 days
      includeSubDomains: true,
      preload: false, // preload submission is a separate, deliberate decision
    },
    // Content-Type sniffing protection.
    noSniff: true,
    // Legacy header; harmless to keep for older clients.
    xssFilter: true,
    referrerPolicy: { policy: "no-referrer" },
    // API responses are never framed.
    frameguard: { action: "deny" },
  });
});
