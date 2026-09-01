import { z } from "zod";

// -----------------------------------------------------------------------
// Every input crossing the untrusted boundary (browser/app -> API) MUST be
// validated with one of these schemas. Never trust client-provided data
// without going through Zod first (spec sections 25 and 34).
// -----------------------------------------------------------------------

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email()
  .max(254);

export const registerOptionsRequestSchema = z.object({
  email: emailSchema,
});

// WebAuthn RegistrationResponseJSON — we validate shape loosely here and let
// @simplewebauthn/server do the cryptographic heavy lifting. We still refuse
// obviously malformed/oversized payloads before it reaches that layer.
export const webAuthnRegistrationResponseSchema = z.object({
  id: z.string().min(1).max(1024),
  rawId: z.string().min(1).max(1024),
  type: z.literal("public-key"),
  clientExtensionResults: z.record(z.unknown()).default({}),
  response: z.object({
    clientDataJSON: z.string().min(1).max(8192),
    attestationObject: z.string().min(1).max(65536),
    transports: z.array(z.string()).optional(),
  }),
});

export const webAuthnAuthenticationResponseSchema = z.object({
  id: z.string().min(1).max(1024),
  rawId: z.string().min(1).max(1024),
  type: z.literal("public-key"),
  clientExtensionResults: z.record(z.unknown()).default({}),
  response: z.object({
    clientDataJSON: z.string().min(1).max(8192),
    authenticatorData: z.string().min(1).max(8192),
    signature: z.string().min(1).max(8192),
    userHandle: z.string().max(1024).optional(),
  }),
});

export const loginOptionsRequestSchema = z.object({
  email: emailSchema,
});

export const registerVerifyRequestSchema = z.object({
  email: emailSchema,
  challengeId: z.string().uuid(),
  credential: webAuthnRegistrationResponseSchema,
});

export const loginVerifyRequestSchema = z.object({
  email: emailSchema,
  challengeId: z.string().uuid(),
  credential: webAuthnAuthenticationResponseSchema,
});

// The 3-Touch sequence is 3 symbols out of a small fixed palette. Explicitly
// NOT treated as a cryptographic secret (spec section 4/34) — it is bound to
// an already-verified WebAuthn intermediate nonce.
export const touchSymbolSchema = z.enum(["circle", "square", "triangle", "diamond", "cross", "star"]);

export const touchSequenceSchema = z.tuple([touchSymbolSchema, touchSymbolSchema, touchSymbolSchema]);

export const registerTouchSequenceRequestSchema = z.object({
  sequence: touchSequenceSchema,
});

export const verifyTouchSequenceRequestSchema = z.object({
  nonceId: z.string().uuid(),
  sequence: touchSequenceSchema,
});

export const deviceIdParamSchema = z.object({
  id: z.string().uuid(),
});

export const credentialIdParamSchema = z.object({
  id: z.string().uuid(),
});

export const sessionIdParamSchema = z.object({
  id: z.string().uuid(),
});
