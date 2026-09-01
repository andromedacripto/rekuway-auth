import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
  AuthenticatorDevice,
} from "@simplewebauthn/types";
import type { Env } from "@rekuway/config";

// The `challenge` field is intentionally NOT accepted as an input param on
// the "build*Options" functions below: @simplewebauthn/server generates its
// own cryptographically random challenge internally and returns it on
// `options.challenge`. The caller must persist THAT returned value as the
// expected challenge — generating our own random string and passing it in
// causes a double base64url-encoding mismatch during verification.

export interface ExistingCredentialForExclusion {
  credentialId: string;
  transports?: AuthenticatorTransportFuture[] | undefined;
}

export async function buildRegistrationOptions(params: {
  env: Env;
  userId: string;
  userEmail: string;
  excludeCredentials: ExistingCredentialForExclusion[];
}) {
  return generateRegistrationOptions({
    rpName: params.env.RP_NAME,
    rpID: params.env.RP_ID,
    userID: new TextEncoder().encode(params.userId),
    userName: params.userEmail,
    attestationType: "none",
    excludeCredentials: params.excludeCredentials.map((c) => {
      const entry: { id: string; transports?: AuthenticatorTransportFuture[] } = { id: c.credentialId };
      if (c.transports) entry.transports = c.transports;
      return entry;
    }),
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "required",
    },
    supportedAlgorithmIDs: [-7, -257],
  });
}

export async function verifyRegistration(params: {
  response: unknown;
  expectedChallenge: string;
  env: Env;
}) {
  return verifyRegistrationResponse({
    response: params.response as RegistrationResponseJSON,
    expectedChallenge: params.expectedChallenge,
    expectedOrigin: params.env.ORIGIN,
    expectedRPID: params.env.RP_ID,
    requireUserVerification: true,
  });
}

export async function buildAuthenticationOptions(params: {
  env: Env;
  allowCredentials: ExistingCredentialForExclusion[];
}) {
  return generateAuthenticationOptions({
    rpID: params.env.RP_ID,
    userVerification: "required",
    allowCredentials: params.allowCredentials.map((c) => {
      const entry: { id: string; transports?: AuthenticatorTransportFuture[] } = { id: c.credentialId };
      if (c.transports) entry.transports = c.transports;
      return entry;
    }),
  });
}

export async function verifyAuthentication(params: {
  env: Env;
  response: unknown;
  expectedChallenge: string;
  credentialPublicKey: Uint8Array;
  credentialId: string;
  credentialCounter: number;
  transports?: AuthenticatorTransportFuture[] | undefined;
}) {
  const authenticator: AuthenticatorDevice = {
    credentialID: params.credentialId,
    credentialPublicKey: params.credentialPublicKey,
    counter: params.credentialCounter,
    ...(params.transports ? { transports: params.transports } : {}),
  };

  return verifyAuthenticationResponse({
    response: params.response as AuthenticationResponseJSON,
    expectedChallenge: params.expectedChallenge,
    expectedOrigin: params.env.ORIGIN,
    expectedRPID: params.env.RP_ID,
    requireUserVerification: true,
    authenticator,
  });
}
