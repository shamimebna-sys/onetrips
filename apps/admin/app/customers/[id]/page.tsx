"use client";

import { AdminShell } from "../../components/AdminShell";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type Customer = {
  id: string;
  email: string | null;
  phone: string | null;
  displayName: string | null;
  status: string;
  firstName: string | null;
  lastName: string | null;
  createdAt: string;
  bookings: Array<{ id: string; bookingRef: string; status: string; totalAmount: number; currency: string }>;
};

export default function CustomerDetailPage() {
  const params = useParams<{ id: string }>();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [error, setError] = useState("");

  const load = async () => {
    const res = await fetch(`/api/customers/${params.id}`);
    const data = await res.json();
    if (!res.ok) setError(data.message || "Unable to load customer");
    else setCustomer(data.customer);
  };

  useEffect(() => {
    void load();
  }, [params.id]);

  const patch = async (status: string) => {
    setError("");
    const res = await fetch(`/api/customers/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const data = await res.json();
    if (!res.ok) setError(data.message || "Update failed");
    await load();
  };

  return (
    <AdminShell>
      <main className="p-8 max-w-5xl space-y-6">
        <Link href="/customers" className="text-[10px] font-black uppercase tracking-widest text-slate-400">Back to customers</Link>
        {error && <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-[10px] font-black uppercase">{error}</div>}
        {customer && (
          <>
            <div className="bg-white border border-slate-100 rounded-[2rem] p-8">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gold">{customer.status}</p>
              <h1 className="text-3xl font-black uppercase tracking-tighter text-ink mt-2">{customer.firstName} {customer.lastName}</h1>
              <p className="font-bold text-slate-500 mt-2">{customer.email} · {customer.phone || "No phone"}</p>
              <div className="flex gap-2 mt-6">
                {(["ACTIVE", "SUSPENDED", "DISABLED"] as const).map((status) => (
                  <button key={status} onClick={() => void patch(status)} className="px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border border-slate-100 text-slate-500 hover:bg-slate-50">
                    {status}
                  </button>
                ))}
              </div>
            </div>
            <div className="bg-white border border-slate-100 rounded-[2rem] overflow-hidden">
              {customer.bookings.length === 0 && <p className="p-8 text-sm font-bold text-slate-400">No bookings.</p>}
              {customer.bookings.map((row) => (
                <Link key={row.id} href={`/bookings/${row.id}`} className="px-6 py-4 border-t border-slate-50 first:border-t-0 flex justify-between hover:bg-slate-50">
                  <p className="font-black uppercase">{row.bookingRef} · {row.status}</p>
                  <p className="font-black">{row.currency} {row.totalAmount.toLocaleString()}</p>
                </Link>
              ))}
            </div>
          </>
        )}
      </main>
    </AdminShell>
  );
}
