import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import { auth } from "./lib/api";
import Today from "./pages/Today";
import Supplements from "./pages/Supplements";
import History from "./pages/History";
import Settings from "./pages/Settings";
import Login from "./pages/Login";

export default function App() {
  const [logged, setLogged] = useState(Boolean(auth.get()));

  useEffect(() => {
    const onUnauthorized = () => setLogged(false);
    window.addEventListener("dosetrack:unauthorized", onUnauthorized);
    return () => window.removeEventListener("dosetrack:unauthorized", onUnauthorized);
  }, []);

  if (!logged) return <Login onLogin={() => setLogged(true)} />;

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Today />} />
        <Route path="/supplements" element={<Supplements />} />
        <Route path="/history" element={<History />} />
        <Route path="/settings" element={<Settings onLogout={() => { auth.clear(); setLogged(false); }} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
