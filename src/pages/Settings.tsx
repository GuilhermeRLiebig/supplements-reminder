import { useEffect, useState } from "react";
import { BellRing, LogOut } from "lucide-react";
import { api } from "../lib/api";

type SettingsData = { telegramLinked: boolean; timezone: string; cron: string };

export default function Settings({ onLogout }: { onLogout: () => void }) {
  const [data, setData] = useState<SettingsData | null>(null);
  const [msg, setMsg] = useState("");
  const load = () => api<SettingsData>("/api/settings").then(setData);
  useEffect(() => { load(); }, []);
  async function test() { setMsg("Enviando..."); try { await api("/api/test-notification", { method:"POST" }); setMsg("Mensagem de teste enviada."); } catch(e){ setMsg(e instanceof Error?e.message:"Erro"); } }
  return <section><header className="page-header"><div><p className="eyebrow">SISTEMA</p><h1>Configurações</h1></div></header>
    <div className="card settings-list"><div><span>Telegram</span><b>{data?.telegramLinked ? "Conectado ✅" : "Não conectado"}</b></div><div><span>Fuso horário</span><b>{data?.timezone || "America/Fortaleza"}</b></div><div><span>Verificação</span><b>A cada 5 min</b></div></div>
    <div className="card help"><h3>Conectar Telegram</h3><ol><li>Crie o bot no <b>@BotFather</b>.</li><li>Configure os secrets e o webhook conforme o README.</li><li>Abra o bot e envie <code>/start SEU_PAIR_CODE</code>.</li></ol><button className="primary" onClick={test}><BellRing size={17}/> Testar notificação</button>{msg&&<p className="muted">{msg}</p>}</div>
    <button className="logout" onClick={onLogout}><LogOut size={17}/> Sair do painel</button>
  </section>;
}
