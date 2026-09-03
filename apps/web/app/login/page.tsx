"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { startAuthentication } from "@simplewebauthn/browser";
import type { PublicKeyCredentialRequestOptionsJSON } from "@simplewebauthn/types";
import { apiPost, ApiRequestError } from "../../lib/api";

export default function LoginPage(): JSX.Element {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [organizationSlug, setOrganizationSlug] = useState("");
  const [status, setStatus] = useState<{ kind: "idle" | "error" | "ok"; message: string }>({
    kind: "idle",
    message: "",
  });
  const [loading, setLoading] = useState(false);

  async function handleLogin(): Promise<void> {
    setLoading(true);
    setStatus({ kind: "idle", message: "" });

    try {
      const { challengeId, options } = await apiPost<{
        challengeId: string;
        options: PublicKeyCredentialRequestOptionsJSON;
      }>("/auth/login/options", { email, organizationSlug });

      const credential = await startAuthentication(options);

      const { nonceId } = await apiPost<{ nonceId: string }>("/auth/login/verify", {
        email,
        organizationSlug,
        challengeId,
        credential,
      });

      // WebAuthn succeeded — now the 3-Touch confirmation step, bound to
      // this nonce. The nonce is the proof; the sequence alone proves nothing.
      sessionStorage.setItem("rekuway_login_nonce", nonceId);
      router.push("/auth/3touch?mode=confirm");
    } catch (err) {
      const message =
        err instanceof ApiRequestError
          ? err.message
          : "Não foi possível autenticar. Tente novamente.";
      setStatus({ kind: "error", message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page">
      <div className="wordmark">Rekuway Auth</div>
      <h1>Entrar</h1>
      <div className="card">
        <div className="field">
          <label htmlFor="organizationSlug">Identificador da empresa</label>
          <input
            id="organizationSlug"
            type="text"
            value={organizationSlug}
            onChange={(e) => setOrganizationSlug(e.target.value)}
            placeholder="acme-corp"
            autoComplete="organization"
          />
        </div>
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
            void handleLogin();
          }}
          disabled={loading || !email || !organizationSlug}
        >
          {loading ? "Aguardando seu dispositivo…" : "Continuar com passkey"}
        </button>
        {status.kind !== "idle" && (
          <p
            className={`status ${status.kind === "error" ? "error" : "ok"}`}
            style={{ marginTop: 16 }}
          >
            {status.message}
          </p>
        )}
      </div>
    </main>
  );
}
