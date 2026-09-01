import * as SecureStore from "expo-secure-store";
import * as LocalAuthentication from "expo-local-authentication";
import type { SecureCredentialStore } from "./SecureCredentialStore";

// Backed by Android Keystore via expo-secure-store. BiometricPrompt gates
// access; biometric data itself never leaves the device (spec section 21).
export class AndroidSecureCredentialStore implements SecureCredentialStore {
  async setItem(key: string, value: string): Promise<void> {
    await SecureStore.setItemAsync(key, value, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED,
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
