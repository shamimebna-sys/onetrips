"use client";

import { AdminShell } from "../components/AdminShell";
import { useEffect, useState } from "react";

type Currency = { id: string; code: string; name: string; symbol: string; isActive: boolean };
type Config = { id: string; key: string; value: string; dataType: string; description: string | null };
type Log = { id: string; recipient: string; status: string; channel: string; createdAt: string };

export default function SettingsPage() {
  const [emailProvider, setEmailProvider] = useState("");
  const [smtpConfigured, setSmtpConfigured] = useState(false);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [config, setConfig] = useState<Config[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [error, setError] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});

  const load = async () => {
    const [settingsRes, notifyRes] = await Promise.all([fetch("/api/settings"), fetch("/api/notifications")]);
    const settings = await settingsRes.json();
    const notify = await notifyRes.json();
    if (!settingsRes.ok) setError(settings.message || "Unable to load settings");
    else {
      setEmailProvider(settings.emailProvider);
      setSmtpConfigured(settings.smtpConfigured);
      setCurrencies(settings.currencies ?? []);
      setConfig(settings.config ?? []);
      setValues(Object.fromEntries((settings.config ?? []).map((row: Config) => [row.key, row.value])));
    }
    if (notifyRes.ok) setLogs(notify.logs ?? []);
  };

  useEffect(() => {
    void load();
  }, []);

  const save = async (row: Config) => {
    setError("");
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: row.key, value: values[row.key] ?? row.value, dataType: row.dataType, description: row.description }),
    });
    const data = await res.json();
    if (!res.ok) setError(data.message || "Save failed");
    await load();
  };

  const toggleCurrency = async (row: Currency) => {
    await fetch(`/api/settings/currencies/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !row.isActive }),
    });
    await load();
  };

  return (
    <AdminShell>
      <main className="p-8 max-w-6xl space-y-8">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-2">Platform</p>
          <h1 className="text-3xl font-black uppercase tracking-tighter text-ink">Settings</h1>
        </div>
        {error && <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-[10px] font-black uppercase">{error}</div>}
        <section className="bg-white border border-slate-100 rounded-[2rem] p-8">
          <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Notifications</h2>
          <p className="font-bold">Email adapter: {emailProvider || "—"} {smtpConfigured ? "(SMTP configured)" : "(console in development)"}</p>
        </section>
        <section className="bg-white border border-slate-100 rounded-[2rem] p-8 space-y-4">
          <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-400">System config</h2>
          {config.map((row) => (
            <form key={row.id} className="flex flex-col md:flex-row gap-3" onSubmit={(e) => { e.preventDefault(); void save(row); }}>
              <div className="md:w-64">
                <p className="font-black uppercase text-xs">{row.key}</p>
                <p className="text-[10px] text-slate-400 font-bold">{row.description}</p>
              </div>
              <input className="flex-1 bg-muted p-3 rounded-xl font-bold outline-none" value={values[row.key] ?? ""} onChange={(e) => setValues({ ...values, [row.key]: e.target.value })} />
              <button className="px-4 py-3 rounded-xl bg-ink text-white text-[9px] font-black uppercase tracking-widest">Save</button>
            </form>
          ))}
        </section>
        <section className="bg-white border border-slate-100 rounded-[2rem] overflow-hidden">
          <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-8 pt-6">Currencies</h2>
          {currencies.map((row) => (
            <div key={row.id} className="px-8 py-4 border-t border-slate-50 flex justify-between items-center">
              <p className="font-black uppercase">{row.code} · {row.name} · {row.symbol}</p>
              <button onClick={() => void toggleCurrency(row)} className="px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border border-slate-100">
                {row.isActive ? "Active" : "Inactive"}
              </button>
            </div>
          ))}
        </section>
        <section className="bg-white border border-slate-100 rounded-[2rem] overflow-hidden">
          <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-8 pt-6">Recent emails</h2>
          {logs.length === 0 && <p className="p-8 text-sm font-bold text-slate-400">No notification logs yet.</p>}
          {logs.map((row) => (
            <div key={row.id} className="px-8 py-4 border-t border-slate-50 flex justify-between">
              <p className="font-bold text-sm">{row.recipient} · {row.channel}</p>
              <p className="font-black uppercase text-[10px]">{row.status}</p>
            </div>
          ))}
        </section>
      </main>
    </AdminShell>
  );
}
