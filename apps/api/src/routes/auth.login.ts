import type { FastifyInstance } from "fastify";
import type { WebAuthnCredential } from "@prisma/client";
import type { AuthenticatorTransportFuture } from "@simplewebauthn/types";
import {
  loginOptionsRequestSchema,
  loginVerifyRequestSchema,
  verifyTouchSequenceRequestSchema,
  GENERIC_AUTH_FAILURE_MESSAGE,
} from "@rekuway/shared";
import { RATE_LIMITS } from "@rekuway/security";
import { ChallengeStore } from "../lib/challengeStore.js";
import { IntermediateNonceStore } from "../lib/intermediateNonce.js";
import { buildAuthenticationOptions, verifyAuthentication } from "../lib/webauthn.js";
import { logSecurityEvent } from "../lib/securityEvents.js";
import { checkTouchSequence } from "../lib/touchSequence.js";
import { checkAndIncrement } from "../lib/rateLimiter.js";
import { SessionManager } from "../lib/sessionManager.js";
import { resolveOrganizationBySlug } from "../lib/organization.js";
import { SESSION_COOKIE_NAME } from "../plugins/session.js";
import type { Env } from "@rekuway/config";

export function registerAuthLoginRoutes(app: FastifyInstance, env: Env): void {
  const challengeStore = new ChallengeStore(app.redis);
  const nonceStore = new IntermediateNonceStore(app.redis);

  // POST /auth/login/options
  app.post("/auth/login/options", async (req, reply) => {
    const parsed = loginOptionsRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ code: "VALIDATION_ERROR", message: "Invalid input." });
    }

    const org = await resolveOrganizationBySlug(app.prisma, parsed.data.organizationSlug);
    if (!org) {
      return reply.status(400).send({ code: "VALIDATION_ERROR", message: "Unknown organization." });
    }

    const perUser = await checkAndIncrement(
      app.redis,
      `ratelimit:login-options:${org.id}:${parsed.data.email}`,
      RATE_LIMITS.perUser.max,
      RATE_LIMITS.perUser.windowSeconds,
    );
    if (!perUser.allowed) {
      await logSecurityEvent(app.prisma, { type: "RATE_LIMIT_TRIGGERED" }, req.ip);
      return reply
        .status(429)
        .send({ code: "RATE_LIMITED", message: "Too many attempts. Try again shortly." });
    }

    const user = await app.prisma.user.findUnique({
      where: { organizationId_email: { organizationId: org.id, email: parsed.data.email } },
      include: { credentials: { where: { revokedAt: null } } },
    });

    // Enumeration protection: always create a challenge and return options
    // in the SAME shape, even when the user doesn't exist. The
    // allowCredentials list is simply empty in that case, which is
    // indistinguishable at the network/timing level from "user has no
    // credentials yet" — a legitimate state.
    const options = await buildAuthenticationOptions({
      env,
      allowCredentials:
        user?.credentials.map((c: WebAuthnCredential) => ({
          credentialId: c.credentialId,
          transports: c.transports as AuthenticatorTransportFuture[],
        })) ?? [],
    });

    // Persist the EXACT challenge the library generated and put on
    // `options.challenge` — never re-derive or re-encode it ourselves.
    const challenge = await challengeStore.create("LOGIN", user?.id ?? null, options.challenge);

    await logSecurityEvent(app.prisma, { type: "AUTHENTICATION_STARTED" }, req.ip);

    return reply.send({ challengeId: challenge.challengeId, options });
  });

  // POST /auth/login/verify — verifies WebAuthn, then issues an
  // intermediate nonce for the 3-Touch confirmation step. Does NOT create a
  // session yet.
  app.post("/auth/login/verify", async (req, reply) => {
    const parsed = loginVerifyRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ code: "VALIDATION_ERROR", message: "Invalid input." });
    }

    const fail = async (): Promise<void> => {
      await logSecurityEvent(app.prisma, { type: "AUTHENTICATION_FAILED" }, req.ip);
    };

    const org = await resolveOrganizationBySlug(app.prisma, parsed.data.organizationSlug);
    if (!org) {
      await fail();
      return reply
        .status(400)
        .send({ code: "AUTHENTICATION_FAILED", message: GENERIC_AUTH_FAILURE_MESSAGE });
    }

    const consumed = await challengeStore.consume(parsed.data.challengeId, "LOGIN");
    if (!consumed) {
      const replay = await challengeStore.isReplay(parsed.data.challengeId);
      if (replay) {
        await logSecurityEvent(app.prisma, { type: "CHALLENGE_REPLAY_DETECTED" }, req.ip);
      }
      await fail();
      return reply
        .status(400)
        .send({ code: "AUTHENTICATION_FAILED", message: GENERIC_AUTH_FAILURE_MESSAGE });
    }

    const user = await app.prisma.user.findUnique({
      where: { organizationId_email: { organizationId: org.id, email: parsed.data.email } },
    });
    if (!user || user.id !== consumed.userId) {
      await fail();
      return reply
        .status(400)
        .send({ code: "AUTHENTICATION_FAILED", message: GENERIC_AUTH_FAILURE_MESSAGE });
    }

    const credential = await app.prisma.webAuthnCredential.findUnique({
      where: { credentialId: parsed.data.credential.id },
    });
    if (!credential || credential.userId !== user.id || credential.revokedAt) {
      await fail();
      return reply
        .status(400)
        .send({ code: "AUTHENTICATION_FAILED", message: GENERIC_AUTH_FAILURE_MESSAGE });
    }

    try {
      const verification = await verifyAuthentication({
        env,
        response: parsed.data.credential,
        expectedChallenge: consumed.challenge,
        credentialPublicKey: new Uint8Array(credential.publicKey),
        credentialId: credential.credentialId,
        credentialCounter: Number(credential.counter),
      });

      if (!verification.verified) {
        await fail();
        return reply
          .status(400)
          .send({ code: "AUTHENTICATION_FAILED", message: GENERIC_AUTH_FAILURE_MESSAGE });
      }

      // Signature counter regression is a strong signal of a cloned
      // authenticator (spec section 19/33) — reject and flag it.
      const newCounter = verification.authenticationInfo.newCounter;
      if (newCounter !== 0 && newCounter <= Number(credential.counter)) {
        await logSecurityEvent(
          app.prisma,
          { type: "AUTHENTICATION_FAILED", userId: user.id },
          req.ip,
        );
        return reply
          .status(400)
          .send({ code: "AUTHENTICATION_FAILED", message: GENERIC_AUTH_FAILURE_MESSAGE });
      }

      await app.prisma.webAuthnCredential.update({
        where: { id: credential.id },
        data: { counter: BigInt(newCounter) },
      });

      const nonce = await nonceStore.create(user.id, credential.credentialId);

      return reply.send({ nonceId: nonce.nonceId, expiresAt: nonce.expiresAt });
    } catch (err) {
      req.log.warn({ err: (err as Error).message }, "authentication verification failed");
      await fail();
      return reply
        .status(400)
        .send({ code: "AUTHENTICATION_FAILED", message: GENERIC_AUTH_FAILURE_MESSAGE });
    }
  });

  // POST /auth/login/3touch/verify — the final step. Only accepts the
  // sequence when bound to a nonce that WebAuthn already validated
  // (spec sections 11/34). Creates the session on success.
  app.post("/auth/login/3touch/verify", async (req, reply) => {
    const parsed = verifyTouchSequenceRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ code: "VALIDATION_ERROR", message: "Invalid input." });
    }

    const nonce = await nonceStore.consume(parsed.data.nonceId);
    if (!nonce) {
      return reply
        .status(400)
        .send({ code: "AUTHENTICATION_FAILED", message: GENERIC_AUTH_FAILURE_MESSAGE });
    }

    const rl = await checkAndIncrement(
      app.redis,
      `ratelimit:touch:${nonce.userId}`,
      RATE_LIMITS.touchSequence.max,
      RATE_LIMITS.touchSequence.windowSeconds,
    );
    if (!rl.allowed) {
      await logSecurityEvent(
        app.prisma,
        { type: "RATE_LIMIT_TRIGGERED", userId: nonce.userId },
        req.ip,
      );
      return reply
        .status(429)
        .send({ code: "RATE_LIMITED", message: "Too many attempts. Try again shortly." });
    }

    const matches = await checkTouchSequence(app.prisma, nonce.userId, parsed.data.sequence);
    if (!matches) {
      await logSecurityEvent(
        app.prisma,
        { type: "TOUCH_SEQUENCE_FAILED", userId: nonce.userId },
        req.ip,
      );
      return reply
        .status(400)
        .send({ code: "AUTHENTICATION_FAILED", message: GENERIC_AUTH_FAILURE_MESSAGE });
    }

    const sessionManager = new SessionManager(app.prisma, app.redis);
    const session = await sessionManager.create(nonce.userId, null);

    await logSecurityEvent(app.prisma, { type: "SESSION_CREATED", userId: nonce.userId }, req.ip);
    await logSecurityEvent(
      app.prisma,
      { type: "AUTHENTICATION_SUCCESS", userId: nonce.userId },
      req.ip,
    );

    void reply.setCookie(SESSION_COOKIE_NAME, session.id, {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      expires: session.expiresAt,
      signed: true,
    });

    return reply.send({ authenticated: true });
  });
}
