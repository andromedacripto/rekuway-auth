"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppTabs } from "../../components/AppTabs";
import { apiGet, apiDelete, ApiRequestError } from "../../lib/api";

interface Credential {
  id: string;
  credentialId: string;
  deviceType: string;
  backedUp: boolean;
  transports: string[];
  createdAt: string;
}

export default function CredentialsPage(): JSX.Element {
  const router = useRouter();
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [loading, setLoading] = useState(true);

  async function load(): Promise<void> {
    try {
      const res = await apiGet<{ credentials: Credential[] }>("/auth/credentials");
      setCredentials(res.credentials);
    } catch (err) {
      if (err instanceof ApiRequestError && err.code === "SESSION_INVALID") {
        router.push("/login");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function revoke(id: string): Promise<void> {
    await apiDelete(`/auth/credentials/${id}`);
    await load();
  }

  return (
    <main className="page">
      <div className="wordmark">Rekuway Auth</div>
      <AppTabs />
      <h1>Credentials</h1>
      <div className="card">
        {loading && <p className="badge">Carregando…</p>}
        {!loading && credentials.length === 0 && <p className="badge">Nenhuma passkey registrada.</p>}
        {credentials.map((c) => (
          <div key={c.id} className="list-row">
            <div>
              <div>Passkey · {c.deviceType === "multiDevice" ? "sincronizada" : "vinculada ao dispositivo"}</div>
              <div className="badge">
                Criada em {new Date(c.createdAt).toLocaleDateString("pt-BR")} · {c.transports.join(", ") || "—"}
              </div>
            </div>
            <button
              className="danger"
              style={{ width: "auto", padding: "6px 12px" }}
              onClick={() => {
                void revoke(c.id);
              }}
            >
              Revogar
            </button>
          </div>
        ))}
      </div>
    </main>
  );
}
