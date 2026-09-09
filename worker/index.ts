type Env = {
  DB: D1Database;
  ASSETS: Fetcher;
  ADMIN_TOKEN: string;
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_WEBHOOK_SECRET: string;
  TELEGRAM_PAIR_CODE: string;
};

type ScheduleRow = {
  id: string;
  supplement_id: string;
  name: string;
  dose_value: string;
  dose_unit: string;
  instructions: string;
  time_local: string;
  days_of_week: string;
  timezone: string;
  reminder_interval_min: number;
  max_reminders: number;
};

const json = (data: unknown, init: ResponseInit = {}) => new Response(JSON.stringify(data), { ...init, headers: { "content-type": "application/json; charset=utf-8", ...(init.headers || {}) } });
const nowIso = () => new Date().toISOString();
const uid = () => crypto.randomUUID();

function isAuthorized(req: Request, env: Env) {
  return req.headers.get("authorization") === `Bearer ${env.ADMIN_TOKEN}`;
}

function localParts(timeZone: string, date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    weekday: "short"
  }).formatToParts(date);
  const get = (type: string) => parts.find(p => p.type === type)?.value || "";
  const weekdayMap: Record<string, number> = { Sun:0, Mon:1, Tue:2, Wed:3, Thu:4, Fri:5, Sat:6 };
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}`, weekday: weekdayMap[get("weekday")] };
}

async function getSetting(env: Env, key: string) {
  return (await env.DB.prepare("SELECT value FROM app_settings WHERE key = ?").bind(key).first<{value:string}>())?.value || null;
}

async function setSetting(env: Env, key: string, value: string) {
  await env.DB.prepare("INSERT INTO app_settings(key,value,updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at").bind(key,value,nowIso()).run();
}

async function telegram(env: Env, method: string, body: unknown) {
  const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify(body) });
  const data = await res.json<any>();
  if (!data.ok) throw new Error(data.description || `Telegram ${method} falhou`);
  return data.result;
}

async function sendReminder(env: Env, intake: any) {
  const chatId = await getSetting(env, "telegram_chat_id");
  if (!chatId) return null;
  const text = `💊 <b>${escapeHtml(intake.name)}</b>\nDose: ${escapeHtml(intake.dose_value)} ${escapeHtml(intake.dose_unit)}\nHorário: ${escapeHtml(intake.scheduled_time)}${intake.instructions ? `\n${escapeHtml(intake.instructions)}` : ""}\n\nConfirme quando tomar.`;
  return telegram(env, "sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    reply_markup: { inline_keyboard: [
      [{ text:"✅ Tomei", callback_data:`take:${intake.id}` }, { text:"⏰ +15 min", callback_data:`snooze:${intake.id}:15` }],
      [{ text:"❌ Pular hoje", callback_data:`skip:${intake.id}` }]
    ]}
  });
}

function escapeHtml(value: unknown) {
  return String(value ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");
}

async function ensureTodaysIntakes(env: Env) {
  const { results } = await env.DB.prepare(`SELECT s.*, p.name, p.dose_value, p.dose_unit, p.instructions FROM schedules s JOIN supplements p ON p.id=s.supplement_id WHERE s.active=1 AND p.active=1`).all<ScheduleRow>();
  const currentUtc = nowIso();
  for (const s of results) {
    const local = localParts(s.timezone);
    const days = JSON.parse(s.days_of_week) as number[];
    if (!days.includes(local.weekday)) continue;
    const shouldNotify = local.time >= s.time_local;
    await env.DB.prepare(`INSERT OR IGNORE INTO intakes(id,schedule_id,supplement_id,due_date,scheduled_time,status,reminder_count,next_reminder_at,created_at,updated_at) VALUES(?,?,?,?,?,'pending',0,?,?,?)`)
      .bind(uid(), s.id, s.supplement_id, local.date, s.time_local, shouldNotify ? currentUtc : null, currentUtc, currentUtc).run();
    if (shouldNotify) {
      await env.DB.prepare("UPDATE intakes SET next_reminder_at=?, updated_at=? WHERE schedule_id=? AND due_date=? AND status='pending' AND next_reminder_at IS NULL")
        .bind(currentUtc,currentUtc,s.id,local.date).run();
    }
  }
}

async function processReminders(env: Env) {
  await ensureTodaysIntakes(env);
  const current = nowIso();

  const due = await env.DB.prepare(`SELECT i.*, p.name, p.dose_value, p.dose_unit, p.instructions, s.reminder_interval_min, s.max_reminders FROM intakes i JOIN supplements p ON p.id=i.supplement_id JOIN schedules s ON s.id=i.schedule_id WHERE i.status='pending' AND i.next_reminder_at IS NOT NULL AND i.next_reminder_at <= ? ORDER BY i.next_reminder_at LIMIT 50`).bind(current).all<any>();

  for (const intake of due.results) {
    if (intake.reminder_count >= intake.max_reminders) {
      await env.DB.prepare("UPDATE intakes SET status='missed', updated_at=? WHERE id=? AND status='pending'").bind(current,intake.id).run();
      continue;
    }
    try {
      const sent = await sendReminder(env, intake);
      if (!sent) continue;
      const next = new Date(Date.now() + intake.reminder_interval_min * 60_000).toISOString();
      await env.DB.prepare("UPDATE intakes SET reminder_count=reminder_count+1,next_reminder_at=?,telegram_message_id=?,updated_at=? WHERE id=? AND status='pending'")
        .bind(next, sent.message_id ?? null, current, intake.id).run();
    } catch (e) {
      console.error("reminder error", intake.id, e);
    }
  }
}

async function updateIntake(env: Env, id: string, action: "taken"|"skip"|"snooze", minutes = 15) {
  const current = nowIso();
  if (action === "taken") {
    return env.DB.prepare("UPDATE intakes SET status='taken',taken_at=?,next_reminder_at=NULL,updated_at=? WHERE id=? AND status='pending'").bind(current,current,id).run();
  }
  if (action === "skip") {
    return env.DB.prepare("UPDATE intakes SET status='skipped',skipped_at=?,next_reminder_at=NULL,updated_at=? WHERE id=? AND status='pending'").bind(current,current,id).run();
  }
  const safeMinutes = Math.min(Math.max(Number(minutes)||15,5),180);
  const next = new Date(Date.now() + safeMinutes*60_000).toISOString();
  return env.DB.prepare("UPDATE intakes SET next_reminder_at=?,updated_at=? WHERE id=? AND status='pending'").bind(next,current,id).run();
}

async function handleTelegram(req: Request, env: Env) {
  if (req.headers.get("X-Telegram-Bot-Api-Secret-Token") !== env.TELEGRAM_WEBHOOK_SECRET) return new Response("forbidden",{status:403});
  const update = await req.json<any>();

  if (update.message?.text?.startsWith("/start")) {
    const code = update.message.text.split(/\s+/)[1] || "";
    if (code !== env.TELEGRAM_PAIR_CODE) {
      await telegram(env,"sendMessage",{chat_id:update.message.chat.id,text:"Código de pareamento inválido."});
      return json({ok:true});
    }
    await setSetting(env,"telegram_chat_id",String(update.message.chat.id));
    await telegram(env,"sendMessage",{chat_id:update.message.chat.id,text:"✅ DoseTrack conectado. Você receberá seus lembretes por aqui."});
    return json({ok:true});
  }

  if (update.callback_query) {
    const q = update.callback_query;
    const [action,id,arg] = String(q.data || "").split(":");
    if (action === "take") await updateIntake(env,id,"taken");
    else if (action === "skip") await updateIntake(env,id,"skip");
    else if (action === "snooze") await updateIntake(env,id,"snooze",Number(arg)||15);
    else return json({ok:true});

    const label = action === "take" ? "✅ Registrado como tomado." : action === "skip" ? "⏭️ Pulado hoje." : `⏰ Lembrarei em ${Number(arg)||15} minutos.`;
    await telegram(env,"answerCallbackQuery",{callback_query_id:q.id,text:label});
    if (q.message?.chat?.id && q.message?.message_id) {
      await telegram(env,"editMessageReplyMarkup",{chat_id:q.message.chat.id,message_id:q.message.message_id,reply_markup:{inline_keyboard:[]}}).catch(()=>null);
    }
    return json({ok:true});
  }
  return json({ok:true});
}

async function apiRouter(req: Request, env: Env, url: URL) {
  if (!isAuthorized(req,env)) return json({error:"Não autorizado"},{status:401});
  const method = req.method;

  if (url.pathname === "/api/health") return json({ok:true});

  if (url.pathname === "/api/supplements" && method === "GET") {
    const {results} = await env.DB.prepare(`SELECT p.*, s.time_local, s.days_of_week, s.reminder_interval_min, s.max_reminders FROM supplements p JOIN schedules s ON s.supplement_id=p.id ORDER BY s.time_local`).all<any>();
    return json({supplements:results.map(x=>({...x,days_of_week:JSON.parse(x.days_of_week)}))});
  }

  if (url.pathname === "/api/supplements" && method === "POST") {
    const b = await req.json<any>();
    if (!b.name?.trim() || !b.dose_value || !b.dose_unit?.trim() || !/^\d{2}:\d{2}$/.test(b.time_local || "")) return json({error:"Preencha nome, dose, unidade e horário."},{status:400});
    if (!Array.isArray(b.days_of_week) || !b.days_of_week.length) return json({error:"Selecione pelo menos um dia."},{status:400});
    const sid=uid(), sched=uid(), current=nowIso();
    await env.DB.batch([
      env.DB.prepare("INSERT INTO supplements(id,name,dose_value,dose_unit,instructions,active,created_at,updated_at) VALUES(?,?,?,?,?,1,?,?)").bind(sid,b.name.trim(),String(b.dose_value),b.dose_unit.trim(),String(b.instructions||""),current,current),
      env.DB.prepare("INSERT INTO schedules(id,supplement_id,time_local,days_of_week,timezone,reminder_interval_min,max_reminders,active,created_at,updated_at) VALUES(?,?,?,?,?,?,?,1,?,?)").bind(sched,sid,b.time_local,JSON.stringify(b.days_of_week),"America/Fortaleza",Math.max(5,Number(b.reminder_interval_min)||30),Math.min(12,Math.max(1,Number(b.max_reminders)||4)),current,current)
    ]);
    await ensureTodaysIntakes(env);
    return json({ok:true,id:sid},{status:201});
  }

  const supplementItem = url.pathname.match(/^\/api\/supplements\/([^/]+)$/);
  if (supplementItem && method === "PATCH") {
    const id = supplementItem[1];
    const b = await req.json<any>();
    if (!b.name?.trim() || !b.dose_value || !b.dose_unit?.trim() || !/^\d{2}:\d{2}$/.test(b.time_local || "")) return json({error:"Preencha nome, dose, unidade e horário."},{status:400});
    if (!Array.isArray(b.days_of_week) || !b.days_of_week.length) return json({error:"Selecione pelo menos um dia."},{status:400});
    const current=nowIso();
    const schedule = await env.DB.prepare("SELECT id FROM schedules WHERE supplement_id=? LIMIT 1").bind(id).first<{id:string}>();
    if (!schedule) return json({error:"Suplemento não encontrado."},{status:404});
    await env.DB.batch([
      env.DB.prepare("UPDATE supplements SET name=?,dose_value=?,dose_unit=?,instructions=?,updated_at=? WHERE id=?").bind(b.name.trim(),String(b.dose_value),b.dose_unit.trim(),String(b.instructions||""),current,id),
      env.DB.prepare("UPDATE schedules SET time_local=?,days_of_week=?,reminder_interval_min=?,max_reminders=?,updated_at=? WHERE id=?").bind(b.time_local,JSON.stringify(b.days_of_week),Math.max(5,Number(b.reminder_interval_min)||30),Math.min(12,Math.max(1,Number(b.max_reminders)||4)),current,schedule.id)
    ]);
    // Recria apenas a ocorrência ainda pendente de hoje para refletir mudanças de horário.
    const local = localParts("America/Fortaleza");
    await env.DB.prepare("DELETE FROM intakes WHERE schedule_id=? AND due_date=? AND status='pending'").bind(schedule.id,local.date).run();
    await ensureTodaysIntakes(env);
    return json({ok:true});
  }

  if (supplementItem && method === "DELETE") {
    await env.DB.prepare("DELETE FROM supplements WHERE id=?").bind(supplementItem[1]).run();
    return json({ok:true});
  }

  const intakeAction = url.pathname.match(/^\/api\/intakes\/([^/]+)\/(taken|skip|snooze)$/);
  if (intakeAction && method === "POST") {
    const body = intakeAction[2] === "snooze" ? await req.json<any>().catch(()=>({})) : {};
    await updateIntake(env,intakeAction[1],intakeAction[2] as any,body.minutes);
    return json({ok:true});
  }

  if (url.pathname === "/api/today" && method === "GET") {
    await ensureTodaysIntakes(env);
    const local = localParts("America/Fortaleza");
    const {results} = await env.DB.prepare(`SELECT i.*,p.name,p.dose_value,p.dose_unit,p.instructions FROM intakes i JOIN supplements p ON p.id=i.supplement_id WHERE i.due_date=? ORDER BY i.scheduled_time`).bind(local.date).all<any>();
    const stats = await computeStats(env, local.date);
    return json({date:local.date,intakes:results,stats});
  }

  if (url.pathname === "/api/history" && method === "GET") {
    const days = Math.min(365,Math.max(1,Number(url.searchParams.get("days"))||30));
    const since = new Date(Date.now()-(days-1)*86400000).toISOString().slice(0,10);
    const {results} = await env.DB.prepare(`SELECT i.*,p.name,p.dose_value,p.dose_unit,p.instructions FROM intakes i JOIN supplements p ON p.id=i.supplement_id WHERE i.due_date>=? ORDER BY i.due_date DESC,i.scheduled_time DESC`).bind(since).all<any>();
    return json({intakes:results});
  }

  if (url.pathname === "/api/settings" && method === "GET") {
    return json({telegramLinked:Boolean(await getSetting(env,"telegram_chat_id")),timezone:"America/Fortaleza",cron:"*/5 * * * *"});
  }

  if (url.pathname === "/api/test-notification" && method === "POST") {
    const chatId = await getSetting(env,"telegram_chat_id");
    if (!chatId) return json({error:"Telegram ainda não conectado."},{status:400});
    await telegram(env,"sendMessage",{chat_id:chatId,text:"🔔 Teste do DoseTrack: notificações funcionando."});
    return json({ok:true});
  }

  return json({error:"Rota não encontrada"},{status:404});
}

async function computeStats(env: Env, today: string) {
  const since = new Date(Date.now()-29*86400000).toISOString().slice(0,10);
  const row = await env.DB.prepare(`SELECT COUNT(*) total, SUM(CASE WHEN status='taken' THEN 1 ELSE 0 END) taken FROM intakes WHERE due_date>=? AND due_date<=? AND status!='pending'`).bind(since,today).first<any>();
  const total = Number(row?.total||0), taken=Number(row?.taken||0);
  const adherence = total ? Math.round(taken/total*100) : 0;

  const {results} = await env.DB.prepare(`SELECT due_date, COUNT(*) total, SUM(CASE WHEN status='taken' THEN 1 ELSE 0 END) taken FROM intakes WHERE due_date<=? GROUP BY due_date ORDER BY due_date DESC LIMIT 60`).bind(today).all<any>();
  let streak=0;
  for (const d of results) { if (Number(d.total)>0 && Number(d.total)===Number(d.taken)) streak++; else break; }
  return {adherence,streak,taken,total};
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    try {
      if (url.pathname === "/telegram/webhook" && req.method === "POST") return handleTelegram(req,env);
      if (url.pathname.startsWith("/api/")) return apiRouter(req,env,url);
      return env.ASSETS.fetch(req);
    } catch (e) {
      console.error(e);
      return json({error:e instanceof Error?e.message:"Erro interno"},{status:500});
    }
  },
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    console.log("CRON START", new Date().toISOString());

    ctx.waitUntil(
      processReminders(env)
        .then(() => console.log("CRON FINISHED", new Date().toISOString()))
        .catch((error) => console.error("CRON ERROR", error))
    );
  }
} satisfies ExportedHandler<Env>;
