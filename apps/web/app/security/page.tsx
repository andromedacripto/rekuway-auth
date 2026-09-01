"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppTabs } from "../../components/AppTabs";
import { apiGet, ApiRequestError } from "../../lib/api";

interface SecurityEvent {
  id: string;
  eventType: string;
  createdAt: string;
}

export default function SecurityEventsPage(): JSX.Element {
  const router = useRouter();
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const res = await apiGet<{ events: SecurityEvent[] }>("/security/events");
        setEvents(res.events);
      } catch (err) {
        if (err instanceof ApiRequestError && err.code === "SESSION_INVALID") {
          router.push("/login");
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  return (
    <main className="page">
      <div className="wordmark">Rekuway Auth</div>
      <AppTabs />
      <h1>Security Events</h1>
      <div className="card">
        {loading && <p className="badge">Carregando…</p>}
        {!loading && events.length === 0 && <p className="badge">Nenhum evento registrado.</p>}
        {events.map((e) => (
          <div key={e.id} className="list-row">
            <span>{e.eventType.replaceAll("_", " ").toLowerCase()}</span>
            <span className="badge">{new Date(e.createdAt).toLocaleString("pt-BR")}</span>
          </div>
        ))}
      </div>
    </main>
  );
}
