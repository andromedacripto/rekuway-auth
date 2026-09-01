import type { PrismaClient } from "@prisma/client";
import type { Redis } from "ioredis";
import { generateSessionId, SESSION_TTL_SECONDS } from "@rekuway/security";

// Spec section 24: server-side sessions, never JWT. The cookie carries only
// an opaque session ID; state lives in PostgreSQL and is cached in Redis for
// fast lookups without hitting the DB on every request.

function cacheKey(sessionId: string): string {
  return `session:${sessionId}`;
}

export class SessionManager {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly redis: Redis,
  ) {}

  async create(userId: string, deviceId: string | null): Promise<{ id: string; expiresAt: Date }> {
    const id = generateSessionId();
    const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);

    await this.prisma.session.create({
      data: { id, userId, deviceId, expiresAt },
    });

    await this.redis.set(cacheKey(id), userId, "EX", SESSION_TTL_SECONDS);
    return { id, expiresAt };
  }

  /** Returns the userId for a valid, non-revoked, non-expired session — or null. */
  async resolve(sessionId: string): Promise<string | null> {
    const cached = await this.redis.get(cacheKey(sessionId));
    if (cached) return cached;

    const session = await this.prisma.session.findUnique({ where: { id: sessionId } });
    if (!session) return null;
    if (session.revokedAt) return null;
    if (session.expiresAt.getTime() < Date.now()) return null;

    const ttl = Math.max(1, Math.floor((session.expiresAt.getTime() - Date.now()) / 1000));
    await this.redis.set(cacheKey(sessionId), session.userId, "EX", ttl);
    return session.userId;
  }

  async revoke(sessionId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.redis.del(cacheKey(sessionId));
  }

  async revokeAllForUser(userId: string): Promise<void> {
    const sessions = await this.prisma.session.findMany({
      where: { userId, revokedAt: null },
      select: { id: true },
    });
    await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (sessions.length > 0) {
      await this.redis.del(...sessions.map((s: { id: string }) => cacheKey(s.id)));
    }
  }
}
