import type { FastifyInstance } from "fastify";
import type { WebAuthnCredential } from "@prisma/client";
import type { AuthenticatorTransportFuture } from "@simplewebauthn/types";
import {
  registerOptionsRequestSchema,
  registerVerifyRequestSchema,
  registerTouchSequenceRequestSchema,
  GENERIC_AUTH_FAILURE_MESSAGE,
} from "@rekuway/shared";
import { ChallengeStore } from "../lib/challengeStore.js";
import { buildRegistrationOptions, verifyRegistration } from "../lib/webauthn.js";
import { logSecurityEvent } from "../lib/securityEvents.js";
import { saveTouchSequence } from "../lib/touchSequence.js";
import { requireSession } from "../lib/requireSession.js";
import { SessionManager } from "../lib/sessionManager.js";
import { SESSION_COOKIE_NAME } from "../plugins/session.js";
import type { Env } from "@rekuway/config";

export function registerAuthRegisterRoutes(app: FastifyInstance, env: Env): void {
  const challengeStore = new ChallengeStore(app.redis);

  // POST /auth/register/options
  app.post("/auth/register/options", async (req, reply) => {
    const parsed = registerOptionsRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ code: "VALIDATION_ERROR", message: "Invalid input." });
    }

    // Enumeration protection (spec section 27): the response shape and
    // status code are identical whether the email is new or already taken.
    let user = await app.prisma.user.findUnique({
      where: { email: parsed.data.email },
      include: { credentials: { where: { revokedAt: null } } },
    });

    if (!user) {
      user = await app.prisma.user.create({
        data: { email: parsed.data.email },
        include: { credentials: { where: { revokedAt: null } } },
      });
    }

    const options = await buildRegistrationOptions({
      env,
      userId: user.id,
      userEmail: user.email,
      excludeCredentials: user.credentials.map((c: WebAuthnCredential) => ({
        credentialId: c.credentialId,
        transports: c.transports as AuthenticatorTransportFuture[],
      })),
    });

    // Persist the EXACT challenge the library generated and put on
    // `options.challenge` — never re-derive or re-encode it ourselves.
    const challenge = await challengeStore.create("REGISTRATION", user.id, options.challenge);

    await logSecurityEvent(app.prisma, { type: "CHALLENGE_CREATED", userId: user.id }, req.ip);

    return reply.send({ challengeId: challenge.challengeId, options });
  });

  // POST /auth/register/verify
  app.post("/auth/register/verify", async (req, reply) => {
    const parsed = registerVerifyRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ code: "VALIDATION_ERROR", message: "Invalid input." });
    }

    const consumed = await challengeStore.consume(parsed.data.challengeId, "REGISTRATION");
    if (!consumed) {
      const replay = await challengeStore.isReplay(parsed.data.challengeId);
      if (replay) {
        await logSecurityEvent(app.prisma, { type: "CHALLENGE_REPLAY_DETECTED" }, req.ip);
      }
      return reply.status(400).send({ code: "CHALLENGE_INVALID", message: GENERIC_AUTH_FAILURE_MESSAGE });
    }

    const user = await app.prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (!user || user.id !== consumed.userId) {
      return reply.status(400).send({ code: "AUTHENTICATION_FAILED", message: GENERIC_AUTH_FAILURE_MESSAGE });
    }

    try {
      const verification = await verifyRegistration({
        env,
        response: parsed.data.credential,
        expectedChallenge: consumed.challenge,
      });

      if (!verification.verified || !verification.registrationInfo) {
        return reply.status(400).send({ code: "AUTHENTICATION_FAILED", message: GENERIC_AUTH_FAILURE_MESSAGE });
      }

      const { registrationInfo } = verification;

      await app.prisma.webAuthnCredential.create({
        data: {
          userId: user.id,
          credentialId: registrationInfo.credentialID,
          publicKey: Buffer.from(registrationInfo.credentialPublicKey),
          counter: BigInt(registrationInfo.counter),
          deviceType: registrationInfo.credentialDeviceType,
          backedUp: registrationInfo.credentialBackedUp,
          transports: parsed.data.credential.response.transports ?? [],
          aaguid: registrationInfo.aaguid,
        },
      });

      await logSecurityEvent(app.prisma, { type: "CREDENTIAL_REGISTERED", userId: user.id }, req.ip);

      // Successful WebAuthn registration is itself strong proof of identity
      // (a brand-new credential bound to this user was just verified) — log
      // the user in immediately so the 3-Touch enrollment step that follows
      // can be protected by requireSession like every other authenticated
      // action, rather than needing its own separate auth mechanism.
      const sessionManager = new SessionManager(app.prisma, app.redis);
      const session = await sessionManager.create(user.id, null);

      await logSecurityEvent(app.prisma, { type: "SESSION_CREATED", userId: user.id }, req.ip);

      void reply.setCookie(SESSION_COOKIE_NAME, session.id, {
        httpOnly: true,
        secure: env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
        expires: session.expiresAt,
        signed: true,
      });

      return reply.send({ verified: true });
    } catch (err) {
      req.log.warn({ err: (err as Error).message }, "registration verification failed");
      return reply.status(400).send({ code: "AUTHENTICATION_FAILED", message: GENERIC_AUTH_FAILURE_MESSAGE });
    }
  });

  // POST /auth/register/touch-sequence — requires an active session, since
  // this is enrolling the UX layer for an already-authenticated user.
  app.post(
    "/auth/register/touch-sequence",
    { preHandler: requireSession },
    async (req, reply) => {
      const parsed = registerTouchSequenceRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ code: "VALIDATION_ERROR", message: "Invalid input." });
      }

      await saveTouchSequence(app.prisma, req.sessionUserId as string, parsed.data.sequence);
      await logSecurityEvent(
        app.prisma,
        { type: "TOUCH_SEQUENCE_REGISTERED", userId: req.sessionUserId },
        req.ip,
      );

      return reply.send({ saved: true });
    },
  );
}
