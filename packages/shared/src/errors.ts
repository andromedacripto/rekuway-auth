// Consistent, non-enumerating error surface.
// Spec section 27: never reveal "user exists" vs "user doesn't exist"
// through different messages or status codes for auth endpoints.

export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "AUTHENTICATION_FAILED"
  | "CHALLENGE_EXPIRED"
  | "CHALLENGE_INVALID"
  | "RATE_LIMITED"
  | "SESSION_INVALID"
  | "NOT_FOUND"
  | "INTERNAL_ERROR";

export class ApiError extends Error {
  public readonly code: ApiErrorCode;
  public readonly statusCode: number;

  constructor(code: ApiErrorCode, statusCode: number, message: string) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.name = "ApiError";
  }
}

// Intentionally generic — used for BOTH "user not found" and
// "credential/challenge invalid" so an attacker cannot distinguish them.
export const GENERIC_AUTH_FAILURE_MESSAGE = "Authentication could not be completed.";
