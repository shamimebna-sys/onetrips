"use client";

import { AgencyShell } from "../components/AgencyShell";
import { useEffect, useState } from "react";

type Member = { id: string; email: string | null; displayName: string | null; role: string; status: string };

export default function TeamPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ email: "", displayName: "", role: "AGENT", password: "Agent1234" });

  useEffect(() => {
    let ignore = false;
    fetch("/api/members")
      .then(async (res) => {
        const data = await res.json();
        if (ignore) return;
        if (!res.ok) setError(data.message || "Unable to load team");
        else setMembers(data.members ?? []);
      })
      .catch(() => {
        if (!ignore) setError("Unable to load team");
      });
    return () => {
      ignore = true;
    };
  }, []);

  const invite = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    const res = await fetch("/api/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) setError(data.message || "Invite failed");
    else {
      setMembers(data.members ?? []);
      setForm((current) => ({ ...current, email: "", displayName: "" }));
    }
    setSaving(false);
  };

  return (
    <AgencyShell>
      <main className="p-8 max-w-5xl space-y-8">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-2">Agency</p>
          <h1 className="text-3xl font-black uppercase tracking-tighter text-ink">Team</h1>
        </div>
        {error && <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-[10px] font-black uppercase">{error}</div>}
        <div className="bg-white border border-slate-100 rounded-[2rem] overflow-hidden">
          {members.map((row) => (
            <div key={row.id} className="px-8 py-4 border-t border-slate-50 first:border-t-0 flex justify-between gap-3">
              <div>
                <p className="font-black uppercase tracking-tight">{row.displayName || row.email}</p>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">{row.email} · {row.status}</p>
              </div>
              <p className="text-[10px] font-black uppercase tracking-widest text-[#996515]">{row.role}</p>
            </div>
          ))}
        </div>
        <form onSubmit={invite} className="bg-white border border-slate-100 rounded-[2rem] p-8 space-y-3">
          <h2 className="text-xl font-black uppercase tracking-tighter">Invite staff</h2>
          <input required placeholder="Name" className="w-full bg-muted p-4 rounded-2xl font-bold outline-none" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} />
          <input required type="email" placeholder="Email" className="w-full bg-muted p-4 rounded-2xl font-bold outline-none" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <select className="w-full bg-muted p-4 rounded-2xl font-bold outline-none" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            <option value="ADMIN">Admin</option>
            <option value="AGENT">Agent</option>
            <option value="ACCOUNTANT">Accountant</option>
            <option value="VIEWER">Viewer</option>
          </select>
          <input required type="password" placeholder="Temporary password" className="w-full bg-muted p-4 rounded-2xl font-bold outline-none" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <button disabled={saving} className="w-full bg-ink text-white py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-gold">
            {saving ? "Inviting..." : "Add member"}
          </button>
        </form>
      </main>
    </AgencyShell>
  );
}
