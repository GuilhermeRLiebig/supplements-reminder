import { NavLink } from "react-router-dom";
import { CalendarDays, History, Pill, Settings } from "lucide-react";

export default function Layout({ children }: { children: React.ReactNode }) {
  const items = [
    ["/", "Hoje", CalendarDays],
    ["/supplements", "Suplementos", Pill],
    ["/history", "Histórico", History],
    ["/settings", "Config", Settings],
  ] as const;

  return (
    <div className="app-shell">
      <main className="content">{children}</main>
      <nav className="bottom-nav" aria-label="Navegação principal">
        {items.map(([to, label, Icon]) => (
          <NavLink key={to} to={to} end={to === "/"} className={({ isActive }) => isActive ? "active" : ""}>
            <Icon size={21} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
