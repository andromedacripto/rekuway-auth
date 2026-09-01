import Link from "next/link";

export default function LandingPage(): JSX.Element {
  return (
    <main className="page">
      <div className="wordmark">Rekuway Auth</div>
      <h1>Abrir. Três toques. Acesso.</h1>
      <p style={{ color: "var(--text-muted)" }}>
        Autenticação sem senha baseada em WebAuthn/FIDO2. A sequência 3-Touch confirma sua intenção
        depois que seu dispositivo já provou criptograficamente quem você é.
      </p>
      <div className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Link href="/register"><button>Criar conta</button></Link>
        <Link href="/login"><button className="secondary">Entrar</button></Link>
      </div>
      <p className="badge">
        O Rekuway Auth não elimina fraude nem é infalível. Ele reduz o risco de Account Takeover por
        credenciais vazadas ou reutilizadas — veja as limitações no README.
      </p>
    </main>
  );
}
