"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppTabs } from "../../components/AppTabs";
import { apiGet, apiDelete, ApiRequestError } from "../../lib/api";

interface Device {
  id: string;
  deviceName: string;
  platform: string;
  lastSeenAt: string;
}

export default function DevicesPage(): JSX.Element {
  const router = useRouter();
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);

  async function load(): Promise<void> {
    try {
      const res = await apiGet<{ devices: Device[] }>("/auth/devices");
      setDevices(res.devices);
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
    await apiDelete(`/auth/devices/${id}`);
    await load();
  }

  return (
    <main className="page">
      <div className="wordmark">Rekuway Auth</div>
      <AppTabs />
      <h1>Devices</h1>
      <div className="card">
        {loading && <p className="badge">Carregando…</p>}
        {!loading && devices.length === 0 && <p className="badge">Nenhum dispositivo registrado.</p>}
        {devices.map((d) => (
          <div key={d.id} className="list-row">
            <div>
              <div>{d.deviceName}</div>
              <div className="badge">
                {d.platform} · último acesso {new Date(d.lastSeenAt).toLocaleDateString("pt-BR")}
              </div>
            </div>
            <button
              className="danger"
              style={{ width: "auto", padding: "6px 12px" }}
              onClick={() => {
                void revoke(d.id);
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
