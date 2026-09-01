// Spec section 32: the fixed catalog of security events. No secret material
// is ever attached as metadata to any of these.

export const SECURITY_EVENT_TYPES = [
  "AUTHENTICATION_STARTED",
  "AUTHENTICATION_SUCCESS",
  "AUTHENTICATION_FAILED",
  "CHALLENGE_CREATED",
  "CHALLENGE_EXPIRED",
  "CHALLENGE_REPLAY_DETECTED",
  "CREDENTIAL_REGISTERED",
  "CREDENTIAL_REVOKED",
  "TOUCH_SEQUENCE_REGISTERED",
  "TOUCH_SEQUENCE_FAILED",
  "SESSION_CREATED",
  "SESSION_REVOKED",
  "LOGOUT",
  "RATE_LIMIT_TRIGGERED",
] as const;

export type SecurityEventType = (typeof SECURITY_EVENT_TYPES)[number];

export interface SecurityEventInput {
  type: SecurityEventType;
  userId?: string | undefined;
  /** Safe, non-secret contextual metadata only (e.g. deviceId, ip hash). */
  metadata?: Record<string, string | number | boolean> | undefined;
}
