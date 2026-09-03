"use client";

import { AdminShell } from "../../components/AdminShell";
import { useEffect, useState } from "react";

type Snapshot = {
  mode: string;
  provider: string;
  mockScenario: string;
  capabilities: Record<string, boolean>;
  timeouts: Record<string, number>;
  health: {
    status: string;
    lastSuccessAt: string | null;
    lastFailureAt: string | null;
    failureCount: number;
    successCount: number;
    latencyMs: number;
    checkedAt: string;
  };
  circuit: { state: string; failures: number; openedAt: string | null; lastFailureAt: string | null };
  operations: Array<{
    id: string;
    operation: string;
    status: string;
    providerReference: string | null;
    errorCode: string | null;
    correlationId: string;
    startedAt: string;
  }>;
};

export default function FlightIntegrationsPage() {
  const [data, setData] = useState<Snapshot | null>(null);
  const [error, setError] = useState("");

  const load = async () => {
    const res = await fetch("/api/integrations/flights");
    const json = await res.json();
    if (!res.ok) setError(json.message || "Unable to load provider status");
    else {
      setError("");
      setData(json);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <AdminShell>
      <main className="p-8 max-w-6xl space-y-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-2">Integrations</p>
            <h1 className="text-3xl font-black uppercase tracking-tighter text-ink">Flight providers</h1>
            <p className="text-sm font-bold text-slate-500 mt-2">Mock GDS health, circuit, and recent supplier operations. Secrets are never shown.</p>
          </div>
          <button onClick={() => void load()} className="px-6 py-3 rounded-2xl bg-ink text-white text-[10px] font-black uppercase tracking-widest hover:bg-gold">
            Refresh
          </button>
        </div>
        {error && <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-[10px] font-black uppercase">{error}</div>}
        {data && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white border border-slate-100 rounded-[2rem] p-6">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Mode</p>
                <p className="text-2xl font-black mt-2">{data.mode}</p>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-2">{data.provider}</p>
              </div>
              <div className="bg-white border border-slate-100 rounded-[2rem] p-6">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Health</p>
                <p className="text-2xl font-black mt-2">{data.health.status}</p>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-2">
                  {data.health.latencyMs} ms avg · {data.health.failureCount} errors
                </p>
                <p className="text-[10px] font-bold text-slate-400 mt-2">
                  Last ok {data.health.lastSuccessAt ? new Date(data.health.lastSuccessAt).toLocaleString() : "—"}
                </p>
                <p className="text-[10px] font-bold text-slate-400">
                  Last fail {data.health.lastFailureAt ? new Date(data.health.lastFailureAt).toLocaleString() : "—"}
                </p>
              </div>
              <div className="bg-white border border-slate-100 rounded-[2rem] p-6">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Circuit</p>
                <p className="text-2xl font-black mt-2">{data.circuit.state}</p>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-2">{data.circuit.failures} failures</p>
              </div>
              <div className="bg-white border border-slate-100 rounded-[2rem] p-6">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Scenario</p>
                <p className="text-2xl font-black mt-2">{data.mockScenario}</p>
              </div>
            </div>
            <section className="bg-white border border-slate-100 rounded-[2rem] p-8">
              <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Supported operations</h2>
              <p className="font-bold text-sm">{Object.entries(data.capabilities).filter(([, on]) => on).map(([name]) => name).join(" · ")}</p>
            </section>
            <section className="bg-white border border-slate-100 rounded-[2rem] overflow-hidden">
              <div className="p-8 pb-4">
                <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Recent operations</h2>
              </div>
              {data.operations.length === 0 && <p className="px-8 pb-8 text-sm font-bold text-slate-400">No supplier operations recorded yet.</p>}
              {data.operations.map((row) => (
                <div key={row.id} className="px-8 py-4 border-t border-slate-50">
                  <p className="font-black uppercase tracking-tight">{row.operation} · {row.status}</p>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">
                    {row.providerReference || "no PNR"} · {row.errorCode || "ok"} · {row.correlationId.slice(0, 8)}
                  </p>
                </div>
              ))}
            </section>
          </>
        )}
      </main>
    </AdminShell>
  );
}
