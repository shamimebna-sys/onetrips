"use client";

import { AdminShell } from "../components/AdminShell";
import { useEffect, useState } from "react";

type Log = {
  id: string;
  type: string;
  channel: string;
  recipient: string;
  status: string;
  providerRef: string | null;
  createdAt: string;
};

type Overview = {
  providers: { email: string; sms: string; queue: string; smtpConfigured: boolean; smsConfigured: boolean };
  queue: { ready: number; delayed: number; backend: string };
  counts: Record<string, number>;
  logs: Log[];
};

export default function NotificationsPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("ALL");

  const load = async (next = status) => {
    const query = next !== "ALL" ? `?status=${next}` : "";
    const res = await fetch(`/api/notifications${query}`);
    const json = await res.json();
    if (!res.ok) setError(json.message || "Unable to load notifications");
    else {
      setError("");
      setData(json);
    }
  };

  useEffect(() => {
    void load("ALL");
  }, []);

  const retry = async (id: string) => {
    setError("");
    const res = await fetch(`/api/notifications/${id}/retry`, { method: "POST" });
    const json = await res.json();
    if (!res.ok) setError(json.message || "Retry failed");
    await load();
  };

  return (
    <AdminShell>
      <main className="p-8 max-w-6xl space-y-6">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-2">Platform</p>
          <h1 className="text-3xl font-black uppercase tracking-tighter text-ink">Notifications</h1>
        </div>
        {error && <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-[10px] font-black uppercase">{error}</div>}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-100 rounded-[2rem] p-6">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Queue</p>
            <p className="text-2xl font-black mt-2">{data?.queue.backend ?? "—"}</p>
            <p className="text-xs font-bold text-slate-400 mt-1">ready {data?.queue.ready ?? 0} · delayed {data?.queue.delayed ?? 0}</p>
          </div>
          <div className="bg-white border border-slate-100 rounded-[2rem] p-6">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Email</p>
            <p className="text-2xl font-black mt-2">{data?.providers.email ?? "—"}</p>
          </div>
          <div className="bg-white border border-slate-100 rounded-[2rem] p-6">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">SMS</p>
            <p className="text-2xl font-black mt-2">{data?.providers.sms ?? "—"}</p>
          </div>
          <div className="bg-white border border-slate-100 rounded-[2rem] p-6">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Failed</p>
            <p className="text-2xl font-black mt-2">{data?.counts.FAILED ?? 0}</p>
          </div>
        </div>
        <select className="bg-white border border-slate-100 p-4 rounded-2xl font-bold outline-none" value={status} onChange={(e) => { setStatus(e.target.value); void load(e.target.value); }}>
          {["ALL", "QUEUED", "SENT", "FAILED"].map((value) => (
            <option key={value} value={value}>{value}</option>
          ))}
        </select>
        <div className="bg-white border border-slate-100 rounded-[2rem] overflow-hidden">
          {(data?.logs.length ?? 0) === 0 && !error && <p className="p-8 text-sm font-bold text-slate-400">No notification logs yet. Run npm run worker to drain the Redis queue.</p>}
          {(data?.logs ?? []).map((row) => (
            <div key={row.id} className="px-6 py-4 border-t border-slate-50 first:border-t-0 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <p className="font-black uppercase tracking-tight">{row.type} · {row.status}</p>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">
                  {row.recipient} · {row.channel} · {new Date(row.createdAt).toLocaleString()} · {row.providerRef || "—"}
                </p>
              </div>
              {row.status !== "SENT" && (
                <button onClick={() => void retry(row.id)} className="px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border border-slate-100 hover:bg-slate-50">
                  Retry
                </button>
              )}
            </div>
          ))}
        </div>
      </main>
    </AdminShell>
  );
}
