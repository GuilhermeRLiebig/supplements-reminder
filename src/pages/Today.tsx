import { useEffect, useState } from "react";
import { Check, Clock3, RefreshCw, SkipForward } from "lucide-react";
import { api, Intake } from "../lib/api";

type Payload = {
  date: string;
  intakes: Intake[];
  stats: { adherence: number; streak: number; taken: number; total: number };
};

export default function Today() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try { setData(await api<Payload>("/api/today")); setError(""); }
    catch (e) { setError(e instanceof Error ? e.message : "Erro"); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function action(id: string, action: "taken" | "skip" | "snooze") {
    await api(`/api/intakes/${id}/${action}`, {
      method: "POST",
      body: action === "snooze" ? JSON.stringify({ minutes: 15 }) : undefined,
    });
    await load();
  }

  return (
    <section>
      <header className="page-header">
        <div><p className="eyebrow">HOJE</p><h1>Minha rotina</h1></div>
        <button className="icon-btn" onClick={load} aria-label="Atualizar"><RefreshCw size={18} /></button>
      </header>

      {data && (
        <div className="stats-grid">
          <div className="stat card"><strong>{data.stats.adherence}%</strong><span>adesão 30d</span></div>
          <div className="stat card"><strong>{data.stats.streak} 🔥</strong><span>sequência</span></div>
        </div>
      )}

      {loading && <p className="muted">Carregando...</p>}
      {error && <p className="error">{error}</p>}
      {!loading && data?.intakes.length === 0 && <div className="card empty"><h3>Nada agendado ainda</h3><p>Cadastre seu primeiro suplemento na aba Suplementos.</p></div>}

      <div className="stack">
        {data?.intakes.map((item) => (
          <article className={`card intake ${item.status}`} key={item.id}>
            <div className="intake-top">
              <div><h3>{item.name}</h3><p>{item.dose_value} {item.dose_unit}{item.instructions ? ` • ${item.instructions}` : ""}</p></div>
              <span className="time"><Clock3 size={16} /> {item.scheduled_time}</span>
            </div>
            <div className="status-line">Status: <b>{labelStatus(item.status)}</b></div>
            {item.status === "pending" && (
              <div className="actions">
                <button className="primary" onClick={() => action(item.id, "taken")}><Check size={17}/> Tomei</button>
                <button onClick={() => action(item.id, "snooze")}><Clock3 size={17}/> +15 min</button>
                <button onClick={() => action(item.id, "skip")}><SkipForward size={17}/> Pular</button>
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

function labelStatus(status: Intake["status"]) {
  return { pending: "Pendente", taken: "Tomado", skipped: "Pulado", missed: "Não confirmado" }[status];
}
