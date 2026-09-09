import { FormEvent, useState } from "react";
import { LockKeyhole } from "lucide-react";
import { api, auth } from "../lib/api";

export default function Login({ onLogin }: { onLogin: () => void }) {
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    auth.set(token.trim());
    try {
      await api<{ ok: boolean }>("/api/health");
      onLogin();
    } catch {
      auth.clear();
      setError("Chave incorreta.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-wrap">
      <form className="card login-card" onSubmit={submit}>
        <div className="brand-icon"><LockKeyhole /></div>
        <h1>DoseTrack</h1>
        <p className="muted">Seu painel privado de lembretes.</p>
        <label>Chave de acesso</label>
        <input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="ADMIN_TOKEN" autoFocus />
        {error && <p className="error">{error}</p>}
        <button className="primary" disabled={!token.trim() || loading}>{loading ? "Entrando..." : "Entrar"}</button>
      </form>
    </div>
  );
}
