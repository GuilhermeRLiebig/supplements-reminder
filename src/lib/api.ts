export type Supplement = {
  id: string;
  name: string;
  dose_value: string;
  dose_unit: string;
  instructions: string;
  active: number;
  time_local: string;
  days_of_week: number[];
  reminder_interval_min: number;
  max_reminders: number;
};

export type Intake = {
  id: string;
  supplement_id: string;
  name: string;
  dose_value: string;
  dose_unit: string;
  instructions: string;
  due_date: string;
  scheduled_time: string;
  status: "pending" | "taken" | "skipped" | "missed";
  reminder_count: number;
  taken_at: string | null;
};

const KEY = "dosetrack_admin_token";

export const auth = {
  get: () => localStorage.getItem(KEY) || "",
  set: (token: string) => localStorage.setItem(KEY, token),
  clear: () => localStorage.removeItem(KEY),
};

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = auth.get();
  const res = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });

  if (res.status === 401) {
    auth.clear();
    window.dispatchEvent(new Event("dosetrack:unauthorized"));
    throw new Error("Não autorizado");
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Erro na API");
  return data as T;
}
