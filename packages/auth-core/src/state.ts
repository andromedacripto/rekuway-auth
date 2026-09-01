// Platform-independent core. No Android/iOS/browser-specific code here
// (spec section 14).

export type ChallengeStatus = "PENDING" | "USED" | "EXPIRED" | "BLOCKED";

export type ChallengePurpose = "REGISTRATION" | "LOGIN";

export interface ChallengeMetadata {
  challengeId: string;
  challenge: string;
  purpose: ChallengePurpose;
  createdAt: string;
  expiresAt: string;
  status: ChallengeStatus;
  attemptCount: number;
  userId: string | null;
}

export type IntermediateNonceStatus = "PENDING" | "USED" | "EXPIRED";

export interface IntermediateNonce {
  nonceId: string;
  userId: string;
  credentialId: string;
  status: IntermediateNonceStatus;
  createdAt: string;
  expiresAt: string;
}

export type SessionStatus = "ACTIVE" | "REVOKED" | "EXPIRED";

export interface SessionSummary {
  id: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
  status: SessionStatus;
}
