// Spec section 33: RiskEngine interface, with a purely deterministic
// BasicSecurityEngine implementation for the MVP. No ML, no LLM — just
// explicit rules that are easy to audit.

export interface AuthenticationContext {
  recentFailedAttempts: number;
  challengeAgeSeconds: number;
  isNewDevice: boolean;
}

export interface SessionContext {
  sessionAgeSeconds: number;
  sessionTtlSeconds: number;
}

export interface CredentialContext {
  isRevoked: boolean;
  counterRegressed: boolean;
}

export type RiskVerdict = "ALLOW" | "CHALLENGE_AGAIN" | "DENY";

export interface RiskEngine {
  evaluateAuthentication(ctx: AuthenticationContext): RiskVerdict;
  evaluateSession(ctx: SessionContext): RiskVerdict;
  evaluateCredential(ctx: CredentialContext): RiskVerdict;
}

export class BasicSecurityEngine implements RiskEngine {
  evaluateAuthentication(ctx: AuthenticationContext): RiskVerdict {
    if (ctx.recentFailedAttempts >= 5) return "DENY";
    if (ctx.challengeAgeSeconds > 300) return "DENY";
    if (ctx.recentFailedAttempts >= 2 || ctx.isNewDevice) return "CHALLENGE_AGAIN";
    return "ALLOW";
  }

  evaluateSession(ctx: SessionContext): RiskVerdict {
    if (ctx.sessionAgeSeconds > ctx.sessionTtlSeconds) return "DENY";
    return "ALLOW";
  }

  evaluateCredential(ctx: CredentialContext): RiskVerdict {
    if (ctx.isRevoked) return "DENY";
    // A regressed WebAuthn signature counter is a strong signal of a cloned
    // authenticator; the spec calls this out explicitly (section 19).
    if (ctx.counterRegressed) return "DENY";
    return "ALLOW";
  }
}
