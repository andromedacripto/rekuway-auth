import { describe, it, expect, afterAll } from "vitest";
import Redis from "ioredis";
import { IntermediateNonceStore } from "../src/lib/intermediateNonce.js";

const redis = new Redis(process.env.REDIS_URL as string);
const store = new IntermediateNonceStore(redis);

describe("IntermediateNonceStore (3-Touch binding)", () => {
  afterAll(async () => {
    await redis.quit();
  });

  it("creates a PENDING nonce tied to a user and credential", async () => {
    const nonce = await store.create("user-a", "cred-a");
    expect(nonce.status).toBe("PENDING");
    expect(nonce.userId).toBe("user-a");
    expect(nonce.credentialId).toBe("cred-a");
  });

  it("is single-use: a second consume attempt fails", async () => {
    const nonce = await store.create("user-b", "cred-b");

    const first = await store.consume(nonce.nonceId);
    expect(first).not.toBeNull();

    const second = await store.consume(nonce.nonceId);
    expect(second).toBeNull();
  });

  it("rejects an unknown nonce id — 3-Touch alone is never sufficient proof", async () => {
    // This is the direct test of the spec 34/section-11 requirement: the
    // server must never accept a bare 3-Touch sequence without a nonce that
    // proves WebAuthn already succeeded.
    const consumed = await store.consume("nonexistent-nonce-id");
    expect(consumed).toBeNull();
  });
});
