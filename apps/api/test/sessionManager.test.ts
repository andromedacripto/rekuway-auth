import { describe, it, expect, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import Redis from "ioredis";
import { SessionManager } from "../src/lib/sessionManager.js";

const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL as string);
const sessions = new SessionManager(prisma, redis);

describe("SessionManager", () => {
  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { contains: "sessiontest+" } } });
    await prisma.$disconnect();
    await redis.quit();
  });

  it("creates a session and resolves it to the correct userId", async () => {
    const user = await prisma.user.create({ data: { email: "sessiontest+1@example.com" } });
    const session = await sessions.create(user.id, null);

    const resolved = await sessions.resolve(session.id);
    expect(resolved).toBe(user.id);
  });

  it("revoked sessions no longer resolve", async () => {
    const user = await prisma.user.create({ data: { email: "sessiontest+2@example.com" } });
    const session = await sessions.create(user.id, null);

    await sessions.revoke(session.id);
    const resolved = await sessions.resolve(session.id);
    expect(resolved).toBeNull();
  });

  it("revokeAllForUser invalidates every session for that user", async () => {
    const user = await prisma.user.create({ data: { email: "sessiontest+3@example.com" } });
    const s1 = await sessions.create(user.id, null);
    const s2 = await sessions.create(user.id, null);

    await sessions.revokeAllForUser(user.id);

    expect(await sessions.resolve(s1.id)).toBeNull();
    expect(await sessions.resolve(s2.id)).toBeNull();
  });

  it("an unknown session id resolves to null", async () => {
    const resolved = await sessions.resolve("nonexistent-session-id");
    expect(resolved).toBeNull();
  });
});
