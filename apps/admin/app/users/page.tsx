"use client";

import { AdminShell } from "../components/AdminShell";
import { useEffect, useState } from "react";

type User = {
  id: string;
  email: string | null;
  displayName: string | null;
  status: string;
  roles: string[];
};

const ROLES = ["SUPER_ADMIN", "OPERATIONS", "FINANCE", "SUPPORT", "SALES", "CONFIGURATION_ADMIN"];

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ email: "", displayName: "", password: "", role: "OPERATIONS" });

  const load = async () => {
    const res = await fetch("/api/users");
    const data = await res.json();
    if (!res.ok) setError(data.message || "Unable to load users");
    else setUsers(data.users ?? []);
  };

  useEffect(() => {
    void load();
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.message || "Unable to create user");
      return;
    }
    setForm({ email: "", displayName: "", password: "", role: "OPERATIONS" });
    await load();
  };

  const patch = async (id: string, body: object) => {
    setError("");
    const res = await fetch(`/api/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) setError(data.message || "Update failed");
    await load();
  };

  return (
    <AdminShell>
      <main className="p-8 max-w-6xl space-y-8">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-2">Platform</p>
          <h1 className="text-3xl font-black uppercase tracking-tighter text-ink">Admin users</h1>
        </div>
        {error && <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-[10px] font-black uppercase">{error}</div>}
        <form onSubmit={create} className="bg-white border border-slate-100 rounded-[2rem] p-6 grid grid-cols-1 md:grid-cols-5 gap-3">
          <input required type="email" placeholder="Email" className="bg-muted p-4 rounded-2xl font-bold outline-none" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input required placeholder="Name" className="bg-muted p-4 rounded-2xl font-bold outline-none" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} />
          <input required type="password" placeholder="Password" className="bg-muted p-4 rounded-2xl font-bold outline-none" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <select className="bg-muted p-4 rounded-2xl font-bold outline-none" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            {ROLES.map((role) => <option key={role} value={role}>{role}</option>)}
          </select>
          <button className="bg-ink text-white rounded-2xl font-black uppercase text-[11px] tracking-widest hover:bg-gold">Add</button>
        </form>
        <div className="bg-white border border-slate-100 rounded-[2rem] overflow-hidden">
          {users.map((user) => (
            <div key={user.id} className="px-6 py-4 border-t border-slate-50 first:border-t-0 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <p className="font-black uppercase tracking-tight">{user.displayName || user.email}</p>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">{user.email} · {user.status} · {user.roles.join(", ") || "No role"}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <select className="bg-muted p-2 rounded-xl text-[10px] font-black uppercase" value={user.roles[0] ?? "OPERATIONS"} onChange={(e) => void patch(user.id, { role: e.target.value })}>
                  {ROLES.map((role) => <option key={role} value={role}>{role}</option>)}
                </select>
                {(["ACTIVE", "SUSPENDED", "DISABLED"] as const).map((status) => (
                  <button key={status} onClick={() => void patch(user.id, { status })} className="px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border border-slate-100 text-slate-500">
                    {status}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </main>
    </AdminShell>
  );
}
