import { describe, it, expect, afterAll } from "vitest";
import Redis from "ioredis";
import { ChallengeStore } from "../src/lib/challengeStore.js";

const redis = new Redis(process.env.REDIS_URL as string);
const store = new ChallengeStore(redis);

// A fake but plausible base64url-looking challenge, standing in for the
// value @simplewebauthn/server would normally generate — the store itself
// doesn't care about the format, only about lifecycle (single-use, TTL,
// attempt limits), which is what these tests exercise.
const FAKE_CHALLENGE = "R7E-7YrW262d0D_WXPg0rqdVOX8mdna6UPDSiqcDa-w";

describe("ChallengeStore (Rekuway Challenge Layer)", () => {
  afterAll(async () => {
    await redis.quit();
  });

  it("creates a PENDING challenge with crypto-random material", async () => {
    const challenge = await store.create("LOGIN", "user-1", FAKE_CHALLENGE);
    expect(challenge.status).toBe("PENDING");
    expect(challenge.challenge.length).toBeGreaterThan(20);
    expect(challenge.attemptCount).toBe(0);
  });

  it("consumes a challenge exactly once (single-use)", async () => {
    const challenge = await store.create("LOGIN", "user-2", FAKE_CHALLENGE);

    const first = await store.consume(challenge.challengeId, "LOGIN");
    expect(first).not.toBeNull();
    expect(first?.status).toBe("USED");

    // Section 35: anti-replay — same response, second usage must be rejected.
    const second = await store.consume(challenge.challengeId, "LOGIN");
    expect(second).toBeNull();
  });

  it("detects replay after a challenge has been consumed", async () => {
    const challenge = await store.create("LOGIN", "user-3", FAKE_CHALLENGE);
    await store.consume(challenge.challengeId, "LOGIN");

    const isReplay = await store.isReplay(challenge.challengeId);
    expect(isReplay).toBe(true);
  });

  it("rejects a challenge used for the wrong purpose", async () => {
    const challenge = await store.create("REGISTRATION", "user-4", FAKE_CHALLENGE);
    const consumed = await store.consume(challenge.challengeId, "LOGIN");
    expect(consumed).toBeNull();
  });

  it("marks a challenge expired once its TTL has passed", async () => {
    const challenge = await store.create("LOGIN", "user-5", FAKE_CHALLENGE);

    // Force expiry by rewriting the stored metadata with a past expiresAt.
    const past = new Date(Date.now() - 1000).toISOString();
    const raw = await redis.get(`challenge:${challenge.challengeId}`);
    const parsed = JSON.parse(raw as string);
    parsed.expiresAt = past;
    await redis.set(`challenge:${challenge.challengeId}`, JSON.stringify(parsed), "EX", 60);

    const consumed = await store.consume(challenge.challengeId, "LOGIN");
    expect(consumed).toBeNull();

    const after = await store.get(challenge.challengeId);
    expect(after?.status).toBe("EXPIRED");
  });

  it("blocks a challenge after exceeding max attempts", async () => {
    const challenge = await store.create("LOGIN", "user-6", FAKE_CHALLENGE);

    let blocked = false;
    for (let i = 0; i < 6; i += 1) {
      blocked = await store.recordFailedAttempt(challenge.challengeId);
    }

    expect(blocked).toBe(true);
    const consumed = await store.consume(challenge.challengeId, "LOGIN");
    expect(consumed).toBeNull();
  });

  it("returns null for a nonexistent challenge id", async () => {
    const consumed = await store.consume("00000000-0000-0000-0000-000000000000", "LOGIN");
    expect(consumed).toBeNull();
  });
});
