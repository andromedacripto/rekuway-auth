"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { startRegistration } from "@simplewebauthn/browser";
import type { PublicKeyCredentialCreationOptionsJSON } from "@simplewebauthn/types";
import { apiPost, ApiRequestError } from "../../lib/api";

export default function RegisterPage(): JSX.Element {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<{ kind: "idle" | "error" | "ok"; message: string }>({
    kind: "idle",
    message: "",
  });
  const [loading, setLoading] = useState(false);

  async function handleRegister(): Promise<void> {
    setLoading(true);
    setStatus({ kind: "idle", message: "" });

    try {
      const { challengeId, options } = await apiPost<{
        challengeId: string;
        options: PublicKeyCredentialCreationOptionsJSON;
      }>("/auth/register/options", { email });

      const credential = await startRegistration(options);

      await apiPost("/auth/register/verify", { email, challengeId, credential });

      setStatus({ kind: "ok", message: "Credencial criada. Agora defina sua sequência 3-Touch." });
      router.push(`/auth/3touch?mode=enroll`);
    } catch (err) {
      const message =
        err instanceof ApiRequestError
          ? err.message
          : "Não foi possível concluir o registro. Verifique se seu dispositivo suporta passkeys.";
      setStatus({ kind: "error", message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page">
      <div className="wordmark">Rekuway Auth</div>
      <h1>Criar conta</h1>
      <div className="card">
        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@exemplo.com"
            autoComplete="email"
          />
        </div>
        <button
          onClick={() => {
            void handleRegister();
          }}
          disabled={loading || !email}
        >
          {loading ? "Aguardando seu dispositivo…" : "Registrar com passkey"}
        </button>
        {status.kind !== "idle" && (
          <p className={`status ${status.kind === "error" ? "error" : "ok"}`} style={{ marginTop: 16 }}>
            {status.message}
          </p>
        )}
      </div>
    </main>
  );
}