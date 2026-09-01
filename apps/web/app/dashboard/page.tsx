"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppTabs } from "../../components/AppTabs";
import { apiGet, apiPost, ApiRequestError } from "../../lib/api";

interface SessionInfo {
  userId: string;
  email?: string;
}

interface Counts {
  credentials: number;
  devices: number;
  sessions: number;
}

interface SecurityEvent {
  id: string;
  eventType: string;
  createdAt: string;
}

export default function DashboardPage(): JSX.Element {
  const router = useRouter();
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [counts, setCounts] = useState<Counts>({ credentials: 0, devices: 0, sessions: 0 });
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const [sessionInfo, credentials, devices, sessions, securityEvents] = await Promise.all([
          apiGet<SessionInfo>("/auth/session"),
          apiGet<{ credentials: unknown[] }>("/auth/credentials"),
          apiGet<{ devices: unknown[] }>("/auth/devices"),
          apiGet<{ sessions: unknown[] }>("/auth/sessions"),
          apiGet<{ events: SecurityEvent[] }>("/security/events"),
        ]);
        setSession(sessionInfo);
        setCounts({
          credentials: credentials.credentials.length,
          devices: devices.devices.length,
          sessions: sessions.sessions.length,
        });
        setEvents(securityEvents.events.slice(0, 5));
      } catch (err) {
        if (err instanceof ApiRequestError && err.code === "SESSION_INVALID") {
          router.push("/login");
          return;
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  async function handleLogout(): Promise<void> {
    await apiPost("/auth/logout", {});
    router.push("/login");
  }

  if (loading) {
    return (
      <main className="page">
        <p className="badge">Carregando…</p>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="wordmark">Rekuway Auth</div>
      <AppTabs />
      <h1>SECURE</h1>
      <p className="badge">{session?.email}</p>

      <div className="stat-grid">
        <div className="stat">
          <div className="stat-value">{counts.credentials}</div>
          <div className="stat-label">Authenticators</div>
        </div>
        <div className="stat">
          <div className="stat-value">{counts.devices}</div>
          <div className="stat-label">Devices</div>
        </div>
        <div className="stat">
          <div className="stat-value">{counts.sessions}</div>
          <div className="stat-label">Active Sessions</div>
        </div>
        <div className="stat">
          <div className="stat-value">Hoje</div>
          <div className="stat-label">Last Authentication</div>
        </div>
      </div>

      <div className="card">
        <h2 style={{ fontSize: 16, marginTop: 0 }}>Recent Security Events</h2>
        {events.length === 0 && <p className="badge">Nenhum evento ainda.</p>}
        {events.map((e) => (
          <div key={e.id} className="list-row">
            <span>✓ {e.eventType.replaceAll("_", " ").toLowerCase()}</span>
            <span className="badge">{new Date(e.createdAt).toLocaleString("pt-BR")}</span>
          </div>
        ))}
      </div>

      <button
        className="secondary"
        onClick={() => {
          void handleLogout();
        }}
      >
        Sair
      </button>
    </main>
  );
}
