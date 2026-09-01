// SecureCredentialStore abstraction (spec section 20). The mobile app never
// touches AsyncStorage, plain SQLite, or logs for anything sensitive.
//
// IMPORTANT / HONEST LIMITATION (spec section 59 — "regra de parada"):
// True native WebAuthn/FIDO2 ceremonies backed directly by the iOS Secure
// Enclave or Android StrongBox Keystore require native module code that
// Expo's *managed* workflow does not expose out of the box. As of this
// MVP:
//   - expo-secure-store gives us Keychain (iOS) / Keystore-EncryptedSharedPreferences
//     (Android) backed storage for OPAQUE session/session-adjacent material
//     (e.g. a locally cached session id for faster app resume).
//   - It does NOT perform WebAuthn attestation/assertion itself.
//   - Real passkey creation/assertion on mobile should go through the
//     device's OS-level passkey support inside a WebView/browser context
//     (Chrome Custom Tabs / SFSafariViewController) hitting the same
//     apps/web login/register pages, OR through a native config plugin
//     (e.g. expo-dev-client + a native passkeys module) in a later phase.
// This file defines the interface so that swap-in is possible without
// touching call sites — it does not pretend to already have full native
// passkey support wired end-to-end.

export interface SecureCredentialStore {
  setItem(key: string, value: string): Promise<void>;
  getItem(key: string): Promise<string | null>;
  deleteItem(key: string): Promise<void>;
  /** True if biometric/device-passcode gating is available on this device. */
  isBiometricGatingAvailable(): Promise<boolean>;
}
