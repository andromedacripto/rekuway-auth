import type { PrismaClient } from "@prisma/client";
import { createHash } from "node:crypto";
import type { SecurityEventInput } from "@rekuway/auth-core";

// Spec sections 31-32: structured security events, no secrets ever.
// IPs are hashed (not stored raw) so events remain useful for correlation
// during an investigation without permanently storing raw IP addresses.

export function hashIp(ip: string): string {
  return createHash("sha256").update(ip).digest("hex").slice(0, 32);
}

export async function logSecurityEvent(
  prisma: PrismaClient,
  event: SecurityEventInput,
  ip?: string,
): Promise<void> {
  await prisma.securityEvent.create({
    data: {
      eventType: event.type,
      userId: event.userId,
      metadata: event.metadata ?? {},
      ipHash: ip ? hashIp(ip) : null,
    },
  });
}
