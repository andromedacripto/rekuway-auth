import { StyleSheet, Text, View, Button, Linking } from "react-native";

// MVP entry point for the mobile shell. Per the honest limitation documented
// in src/security/SecureCredentialStore.ts, this MVP routes the actual
// WebAuthn/passkey ceremony through the system browser (which has full,
// OS-native passkey support) rather than faking an in-app native ceremony
// that Expo managed workflow cannot yet perform. A dedicated native module
// (via expo-dev-client / a custom config plugin) is the documented next
// step for a fully in-app experience — see README "Limitações".

const WEB_APP_URL = process.env.EXPO_PUBLIC_WEB_URL ?? "http://localhost:3000";

export default function App(): JSX.Element {
  return (
    <View style={styles.container}>
      <Text style={styles.wordmark}>REKUWAY AUTH</Text>
      <Text style={styles.title}>Abrir → 3 toques → Acesso</Text>
      <Text style={styles.body}>
        A criação e o uso de passkeys neste MVP acontecem no navegador do sistema, que já
        possui suporte nativo completo a WebAuthn/Passkeys no iOS e Android.
      </Text>
      <Button
        title="Abrir Rekuway Auth"
        onPress={() => {
          void Linking.openURL(WEB_APP_URL);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0e14",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 16,
  },
  wordmark: {
    color: "#8b96a5",
    fontSize: 13,
    letterSpacing: 2,
  },
  title: {
    color: "#e6edf3",
    fontSize: 24,
    fontWeight: "700",
    textAlign: "center",
  },
  body: {
    color: "#8b96a5",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 16,
  },
});
