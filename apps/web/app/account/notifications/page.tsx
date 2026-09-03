"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { EmptyState, SkeletonBlock } from "@onetrips/ui";

type Row = {
  id: string;
  title: string;
  body: string;
  deepLink: string | null;
  read: boolean;
  createdAt: string;
};

export default function NotificationsPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  useEffect(() => {
    fetch("/api/account/notifications")
      .then((res) => (res.ok ? res.json() : { notifications: [] }))
      .then((data) => setRows(data.notifications ?? []));
  }, []);

  const mark = async (id: string) => {
    await fetch("/api/account/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    setRows((current) => (current ?? []).map((row) => (row.id === id ? { ...row, read: true } : row)));
  };

  if (rows === null) return <SkeletonBlock rows={3} />;
  if (!rows.length) {
    return (
      <EmptyState
        title="You're all caught up"
        description="Important booking and account updates will appear here."
      />
    );
  }

  return (
    <div className="space-y-3">
      <h1 className="text-3xl font-black tracking-tight text-ink">Notifications</h1>
      {rows.map((row) => (
        <button
          key={row.id}
          type="button"
          onClick={() => mark(row.id)}
          className={`w-full rounded-3xl border p-6 text-left ${row.read ? "border-slate-100 bg-white" : "border-gold/40 bg-[#d4af37]/5"}`}
        >
          <p className="font-black uppercase">{row.title}</p>
          <p className="mt-2 text-sm text-slate-500">{row.body}</p>
          {row.deepLink ? (
            <Link href={row.deepLink} className="mt-3 inline-block text-[10px] font-black uppercase tracking-widest text-gold-dark">
              Open
            </Link>
          ) : null}
        </button>
      ))}
    </div>
  );
}
