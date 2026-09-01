import { Platform } from "react-native";
import type { SecureCredentialStore } from "./SecureCredentialStore";
import { AndroidSecureCredentialStore } from "./AndroidSecureCredentialStore";
import { IOSSecureCredentialStore } from "./IOSSecureCredentialStore";

export function getSecureCredentialStore(): SecureCredentialStore {
  if (Platform.OS === "ios") return new IOSSecureCredentialStore();
  // Android and Android tablets share the same Keystore-backed implementation.
  return new AndroidSecureCredentialStore();
}
