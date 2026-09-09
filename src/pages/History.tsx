import { useEffect, useState } from "react";
import { api, Intake } from "../lib/api";

export default function History() {
  const [items, setItems] = useState<Intake[]>([]);
  useEffect(() => { api<{ intakes: Intake[] }>("/api/history?days=30").then(d => setItems(d.intakes)); }, []);
  return <section><header className="page-header"><div><p className="eyebrow">ÚLTIMOS 30 DIAS</p><h1>Histórico</h1></div></header><div className="stack">{items.map(i=><article className="card history-row" key={i.id}><div><h3>{i.name}</h3><p>{i.due_date} • {i.scheduled_time} • {i.dose_value} {i.dose_unit}</p></div><span className={`pill ${i.status}`}>{status(i.status)}</span></article>)}</div>{items.length===0&&<div className="card empty"><p>O histórico aparecerá aqui.</p></div>}</section>;
}
function status(s: Intake["status"]) { return { pending:"Pendente", taken:"Tomado", skipped:"Pulado", missed:"Não confirmado" }[s]; }
