import cors from "@fastify/cors";
import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";

// Spec section 29: explicit CORS configuration. NEVER "*" for authenticated,
// cookie-based endpoints — that would allow any site to ride the user's
// session cookie cross-origin.
export const corsPlugin = fp(async (app: FastifyInstance, opts: { allowedOrigins: string[] }) => {
  await app.register(cors, {
    origin: (origin, callback) => {
      // Same-origin / non-browser requests (no Origin header) are allowed
      // through; the actual authorization still depends on the session cookie.
      if (!origin || opts.allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("Origin not allowed by CORS policy"), false);
    },
    credentials: true,
    methods: ["GET", "POST", "DELETE"],
  });
});
