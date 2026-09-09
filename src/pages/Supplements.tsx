import { FormEvent, useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { api, Supplement } from "../lib/api";

const dayNames = ["D", "S", "T", "Q", "Q", "S", "S"];
const blank = { name: "Creatina", dose_value: "5", dose_unit: "g", instructions: "", time_local: "14:00", days_of_week: [0,1,2,3,4,5,6], reminder_interval_min: 30, max_reminders: 4 };

type FormState = typeof blank;

export default function Supplements() {
  const [items, setItems] = useState<Supplement[]>([]);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(blank);
  const [error, setError] = useState("");

  async function load() { setItems((await api<{ supplements: Supplement[] }>("/api/supplements")).supplements); }
  useEffect(() => { load(); }, []);

  function newItem() { setEditingId(null); setForm(blank); setOpen(true); setError(""); }
  function edit(item: Supplement) {
    setEditingId(item.id);
    setForm({ name:item.name, dose_value:item.dose_value, dose_unit:item.dose_unit, instructions:item.instructions || "", time_local:item.time_local, days_of_week:item.days_of_week, reminder_interval_min:item.reminder_interval_min, max_reminders:item.max_reminders });
    setOpen(true); setError(""); window.scrollTo({top:0,behavior:"smooth"});
  }
  function toggleDay(day: number) { setForm((f) => ({ ...f, days_of_week: f.days_of_week.includes(day) ? f.days_of_week.filter((d) => d !== day) : [...f.days_of_week, day].sort() })); }

  async function submit(e: FormEvent) {
    e.preventDefault(); setError("");
    try {
      await api(editingId ? `/api/supplements/${editingId}` : "/api/supplements", { method: editingId ? "PATCH" : "POST", body: JSON.stringify(form) });
      setOpen(false); setEditingId(null); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Erro"); }
  }

  async function remove(id: string) {
    if (!confirm("Excluir este suplemento, agendamento e histórico relacionado?")) return;
    await api(`/api/supplements/${id}`, { method: "DELETE" }); await load();
  }

  return (
    <section>
      <header className="page-header"><div><p className="eyebrow">CONFIGURAÇÃO</p><h1>Suplementos</h1></div><button className="primary small" onClick={newItem}><Plus size={17}/> Novo</button></header>

      {open && (
        <form className="card form-card" onSubmit={submit}>
          <h3>{editingId ? "Editar suplemento" : "Novo suplemento"}</h3>
          <div className="field-grid two"><div><label>Nome</label><input value={form.name} onChange={e => setForm({...form, name:e.target.value})}/></div><div><label>Horário</label><input type="time" value={form.time_local} onChange={e => setForm({...form,time_local:e.target.value})}/></div></div>
          <div className="field-grid two"><div><label>Dose</label><input value={form.dose_value} onChange={e => setForm({...form,dose_value:e.target.value})}/></div><div><label>Unidade</label><input value={form.dose_unit} onChange={e => setForm({...form,dose_unit:e.target.value})} placeholder="g, mg, cápsula"/></div></div>
          <div><label>Observação</label><input value={form.instructions} onChange={e => setForm({...form,instructions:e.target.value})} placeholder="Ex.: após o almoço"/></div>
          <div><label>Dias da semana</label><div className="days">{dayNames.map((d,i)=><button type="button" key={i} className={form.days_of_week.includes(i)?"selected":""} onClick={()=>toggleDay(i)}>{d}</button>)}</div></div>
          <div className="field-grid two"><div><label>Repetir a cada (min)</label><input type="number" min="5" value={form.reminder_interval_min} onChange={e => setForm({...form,reminder_interval_min:+e.target.value})}/></div><div><label>Máx. lembretes</label><input type="number" min="1" max="12" value={form.max_reminders} onChange={e => setForm({...form,max_reminders:+e.target.value})}/></div></div>
          {error && <p className="error">{error}</p>}
          <div className="form-actions"><button className="primary">{editingId ? "Salvar alterações" : "Salvar suplemento"}</button><button type="button" onClick={()=>{setOpen(false);setEditingId(null)}}>Cancelar</button></div>
        </form>
      )}

      <div className="stack">
        {items.map(item => <article className="card supplement-row" key={item.id}><div><h3>{item.name}</h3><p>{item.dose_value} {item.dose_unit} • {item.time_local} • lembrete {item.reminder_interval_min}min</p></div><div className="row-actions"><button className="icon-btn" onClick={()=>edit(item)} aria-label="Editar"><Pencil size={18}/></button><button className="danger-icon" onClick={()=>remove(item.id)} aria-label="Excluir"><Trash2 size={19}/></button></div></article>)}
      </div>
    </section>
  );
}
