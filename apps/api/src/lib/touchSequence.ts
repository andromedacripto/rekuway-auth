import type { PrismaClient } from "@prisma/client";
import { hashTouchSequence, verifyTouchSequence } from "@rekuway/security";

// Persistence layer for the 3-Touch sequence. See packages/security/src/hash.ts
// for why this is bcrypt-hashed despite being low-entropy — never stored in
// plaintext regardless of its role as UX-layer rather than crypto factor.

export async function saveTouchSequence(
  prisma: PrismaClient,
  userId: string,
  sequence: readonly string[],
): Promise<void> {
  const sequenceHash = await hashTouchSequence(sequence);
  await prisma.touchSequence.upsert({
    where: { userId },
    create: { userId, sequenceHash },
    update: { sequenceHash },
  });
}

export async function checkTouchSequence(
  prisma: PrismaClient,
  userId: string,
  sequence: readonly string[],
): Promise<boolean> {
  const record = await prisma.touchSequence.findUnique({ where: { userId } });
  if (!record) return false;
  return verifyTouchSequence(sequence, record.sequenceHash);
}
