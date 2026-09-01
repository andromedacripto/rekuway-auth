import * as SecureStore from "expo-secure-store";
import * as LocalAuthentication from "expo-local-authentication";
import type { SecureCredentialStore } from "./SecureCredentialStore";

// Backed by iOS Keychain via expo-secure-store. Face ID / Touch ID gate
// access via LocalAuthentication; raw biometric data never leaves the
// device and never reaches the server (spec section 22).
export class IOSSecureCredentialStore implements SecureCredentialStore {
  async setItem(key: string, value: string): Promise<void> {
    await SecureStore.setItemAsync(key, value, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  }

  async getItem(key: string): Promise<string | null> {
    return SecureStore.getItemAsync(key);
  }

  async deleteItem(key: string): Promise<void> {
    await SecureStore.deleteItemAsync(key);
  }

  async isBiometricGatingAvailable(): Promise<boolean> {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    return hasHardware && isEnrolled;
  }
}
