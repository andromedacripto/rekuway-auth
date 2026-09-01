"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { TouchGrid, shuffledSymbolOrder } from "../../../components/TouchGrid";
import { apiPost, ApiRequestError } from "../../../lib/api";

function ThreeTouchInner(): JSX.Element {
  const router = useRouter();
  const params = useSearchParams();
  const mode = params.get("mode") === "enroll" ? "enroll" : "confirm";

  const [selected, setSelected] = useState<string[]>([]);
  // Shuffled only on the client, after mount — Math.random() during SSR
  // would produce a different order than the client re-render, causing a
  // hydration mismatch. Starting empty and filling in useEffect keeps
  // server and client markup identical on the first paint.
  const [order, setOrder] = useState<string[]>([]);
  useEffect(() => {
    setOrder(shuffledSymbolOrder());
  }, []);
  const [status, setStatus] = useState<{ kind: "idle" | "error" | "ok"; message: string }>({
    kind: "idle",
    message: "",
  });
  const [loading, setLoading] = useState(false);

  function handleSelect(id: string): void {
    if (selected.length >= 3 || loading) return;
    const next = [...selected, id];
    setSelected(next);
    if (next.length === 3) {
      void submit(next);
    }
  }

  async function submit(sequence: string[]): Promise<void> {
    setLoading(true);
    setStatus({ kind: "idle", message: "" });

    try {
      if (mode === "enroll") {
        await apiPost("/auth/register/touch-sequence", { sequence });
        setStatus({ kind: "ok", message: "Sequência 3-Touch definida." });
        router.push("/dashboard");
        return;
      }

      const nonceId = sessionStorage.getItem("rekuway_login_nonce");
      if (!nonceId) {
        setStatus({ kind: "error", message: "Sessão de login expirou. Comece novamente." });
        setSelected([]);
        setLoading(false);
        return;
      }

      await apiPost("/auth/login/3touch/verify", { nonceId, sequence });
      sessionStorage.removeItem("rekuway_login_nonce");
      router.push("/dashboard");
    } catch (err) {
      const message = err instanceof ApiRequestError ? err.message : "Sequência incorreta. Tente novamente.";
      setStatus({ kind: "error", message });
      setSelected([]);
      setLoading(false);
    }
  }

  return (
    <main className="page">
      <div className="wordmark">Rekuway Auth</div>
      <h1>{mode === "enroll" ? "Defina sua sequência" : "Confirme seu acesso"}</h1>
      <p style={{ color: "var(--text-muted)" }}>
        {mode === "enroll"
          ? "Toque 3 símbolos, na ordem que quiser lembrar. Isso não substitui sua passkey — é uma confirmação de intenção."
          : "Toque a sequência que você definiu para confirmar este acesso."}
      </p>
      <div className="card">
        <TouchGrid order={order} selected={selected} onSelect={handleSelect} disabled={loading} />
        <p className="badge" style={{ textAlign: "center" }}>
          {selected.length}/3 selecionados
        </p>
        {status.kind !== "idle" && (
          <p className={`status ${status.kind === "error" ? "error" : "ok"}`}>{status.message}</p>
        )}
      </div>
    </main>
  );
}

export default function ThreeTouchPage(): JSX.Element {
  return (
    <Suspense fallback={null}>
      <ThreeTouchInner />
    </Suspense>
  );
}