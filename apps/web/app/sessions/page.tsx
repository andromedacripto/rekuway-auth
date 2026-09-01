"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppTabs } from "../../components/AppTabs";
import { apiGet, apiDelete, ApiRequestError } from "../../lib/api";

interface SessionRow {
  id: string;
  createdAt: string;
  expiresAt: string;
  current: boolean;
}

export default function SessionsPage(): JSX.Element {
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);

  async function load(): Promise<void> {
    try {
      const res = await apiGet<{ sessions: SessionRow[] }>("/auth/sessions");
      setSessions(res.sessions);
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
    await apiDelete(`/auth/sessions/${id}`);
    await load();
  }

  return (
    <main className="page">
      <div className="wordmark">Rekuway Auth</div>
      <AppTabs />
      <h1>Sessions</h1>
      <div className="card">
        {loading && <p className="badge">Carregando…</p>}
        {!loading && sessions.length === 0 && <p className="badge">Nenhuma sessão ativa.</p>}
        {sessions.map((s) => (
          <div key={s.id} className="list-row">
            <div>
              <div>{s.current ? "Esta sessão" : "Sessão ativa"}</div>
              <div className="badge">
                Criada em {new Date(s.createdAt).toLocaleString("pt-BR")} · expira em{" "}
                {new Date(s.expiresAt).toLocaleString("pt-BR")}
              </div>
            </div>
            {!s.current && (
              <button
                className="danger"
                style={{ width: "auto", padding: "6px 12px" }}
                onClick={() => {
                  void revoke(s.id);
                }}
              >
                Revogar
              </button>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}
