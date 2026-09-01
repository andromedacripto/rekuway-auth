import type { Redis } from "ioredis";
import { generateId, INTERMEDIATE_NONCE_TTL_SECONDS } from "@rekuway/security";
import type { IntermediateNonce } from "@rekuway/auth-core";

// This is the piece that makes the 3-Touch step meaningful (spec sections
// 11 and 34): the server never accepts "user tapped circle-square-triangle"
// on its own. It only accepts it bound to a nonce that was issued because
// WebAuthn *already* verified successfully, and that nonce is itself
// single-use and short-lived.

function key(nonceId: string): string {
  return `intermediate:${nonceId}`;
}

export class IntermediateNonceStore {
  constructor(private readonly redis: Redis) {}

  async create(userId: string, credentialId: string): Promise<IntermediateNonce> {
    const nonceId = generateId();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + INTERMEDIATE_NONCE_TTL_SECONDS * 1000);

    const nonce: IntermediateNonce = {
      nonceId,
      userId,
      credentialId,
      status: "PENDING",
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };

    await this.redis.set(key(nonceId), JSON.stringify(nonce), "EX", INTERMEDIATE_NONCE_TTL_SECONDS);
    return nonce;
  }

  async consume(nonceId: string): Promise<IntermediateNonce | null> {
    const raw = await this.redis.get(key(nonceId));
    if (!raw) return null;

    const nonce = JSON.parse(raw) as IntermediateNonce;
    if (nonce.status !== "PENDING") return null;
    if (new Date(nonce.expiresAt).getTime() < Date.now()) return null;

    nonce.status = "USED";
    await this.redis.set(key(nonceId), JSON.stringify(nonce), "EX", 30);
    return nonce;
  }
}
