import bcrypt from "bcrypt";

// The 3-Touch sequence is low-entropy (spec section 34) and is NOT a
// cryptographic secret on its own — but we still never store it in
// plaintext, and we still rate-limit and bind it to a verified WebAuthn
// nonce before accepting it (see apps/api/src/lib/touchSequence.ts).

const SALT_ROUNDS = 12;

export async function hashTouchSequence(sequence: readonly string[]): Promise<string> {
  const normalized = sequence.join(":");
  return bcrypt.hash(normalized, SALT_ROUNDS);
}

export async function verifyTouchSequence(
  sequence: readonly string[],
  hash: string,
): Promise<boolean> {
  const normalized = sequence.join(":");
  return bcrypt.compare(normalized, hash);
}
