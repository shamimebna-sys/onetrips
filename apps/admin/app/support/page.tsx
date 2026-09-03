"use client";

import { AdminShell } from "../components/AdminShell";
import { useEffect, useState } from "react";

type Row = {
  id: string;
  category: string;
  subject: string;
  status: string;
  createdAt: string;
  user?: { email: string | null; displayName: string | null };
};

export default function AdminSupportPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [reply, setReply] = useState("");
  const [active, setActive] = useState<string | null>(null);

  const load = () =>
    fetch("/api/support")
      .then((res) => res.json())
      .then((data) => setRows(data.requests ?? []));

  useEffect(() => {
    load();
  }, []);

  const update = async (id: string, status: string) => {
    await fetch(`/api/support/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, body: reply || undefined }),
    });
    setReply("");
    setActive(null);
    load();
  };

  return (
    <AdminShell>
      <h1 className="mb-6 text-3xl font-black uppercase">Support queue</h1>
      {rows.map((row) => (
        <article key={row.id} className="mb-3 rounded-3xl bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-black uppercase">{row.subject}</p>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                {row.category} · {row.status} · {row.user?.email}
              </p>
            </div>
            <div className="flex gap-2">
              <button className="rounded-xl bg-slate-900 px-4 py-2 text-[10px] font-black uppercase text-white" onClick={() => setActive(row.id)}>
                Reply
              </button>
              <button className="rounded-xl border border-slate-200 px-4 py-2 text-[10px] font-black uppercase" onClick={() => update(row.id, "RESOLVED")}>
                Resolve
              </button>
            </div>
          </div>
          {active === row.id ? (
            <div className="mt-4 space-y-3">
              <textarea className="w-full rounded-2xl bg-slate-50 p-3 font-medium" rows={3} value={reply} onChange={(e) => setReply(e.target.value)} />
              <button className="rounded-xl bg-slate-900 px-4 py-2 text-[10px] font-black uppercase text-white" onClick={() => update(row.id, "PENDING")}>
                Send reply
              </button>
            </div>
          ) : null}
        </article>
      ))}
    </AdminShell>
  );
}
