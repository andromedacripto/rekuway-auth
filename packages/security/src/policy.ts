// Centralized security policy. Changing a TTL or a limit should mean
// changing exactly one number, in exactly one place.

export const CHALLENGE_TTL_SECONDS = {
  registration: 5 * 60,
  login: 3 * 60,
} as const;

export const INTERMEDIATE_NONCE_TTL_SECONDS = 2 * 60;

export const SESSION_TTL_SECONDS = 24 * 60 * 60; // 24h default

export const RATE_LIMITS = {
  // Per-IP limits guard against distributed brute force / scraping.
  perIp: { max: 20, windowSeconds: 60 },
  // Per-user limits guard the account itself, independent of source IP,
  // but are intentionally generous enough that an attacker cannot lock a
  // victim out permanently just by spamming failed attempts (spec section 26).
  perUser: { max: 10, windowSeconds: 60 },
  // 3-Touch verification is checked separately since it is a shorter,
  // lower-entropy step bound to an already-verified WebAuthn nonce.
  touchSequence: { max: 5, windowSeconds: 60 },
} as const;

export const MAX_CHALLENGE_ATTEMPTS = 5;

export const TOUCH_SYMBOLS = ["circle", "square", "triangle", "diamond", "cross", "star"] as const;
