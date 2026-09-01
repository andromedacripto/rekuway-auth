import { randomBytes, randomUUID } from "node:crypto";

// Spec section 6/16: NEVER invent cryptography. Only official Node.js
// crypto APIs (backed by the OS CSPRNG) are used here.

/** UUID v4, used for challengeId, nonceId, and DB primary keys. */
export function generateId(): string {
  return randomUUID();
}

/**
 * Cryptographically random challenge, base64url-encoded, with enough
 * entropy for a WebAuthn challenge (>= 32 bytes / 256 bits per FIDO2 guidance).
 */
export function generateChallenge(byteLength = 32): string {
  return randomBytes(byteLength).toString("base64url");
}

/** Opaque, unguessable session identifier. Never exposes internal structure. */
export function generateSessionId(): string {
  return randomBytes(32).toString("base64url");
}
