"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function AgencyRegisterPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    companyName: "",
    email: "",
    phone: "",
    country: "Bangladesh",
    city: "Dhaka",
    password: "",
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.message || "Unable to register");
      setLoading(false);
      return;
    }
    router.push("/login");
  };

  return (
    <main className="min-h-screen bg-muted flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-lg bg-white rounded-[2.5rem] p-10 border border-slate-100">
        <h1 className="text-2xl font-black tracking-tighter mb-2">
          <span className="text-ink">ONE</span>
          <span className="text-gold">TRIPS</span>
        </h1>
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-8">Register agency</p>
        {error && <div className="bg-red-50 text-red-600 p-3 rounded-2xl text-[10px] font-black uppercase mb-6">{error}</div>}
        <form onSubmit={submit} className="space-y-3">
          {([
            ["fullName", "Owner name"],
            ["companyName", "Agency name"],
            ["email", "Email"],
            ["phone", "Phone"],
            ["city", "City"],
            ["password", "Password"],
          ] as const).map(([key, placeholder]) => (
            <input
              key={key}
              type={key === "password" ? "password" : key === "email" ? "email" : "text"}
              required
              placeholder={placeholder}
              value={form[key]}
              onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              className="w-full bg-muted p-4 rounded-2xl font-bold outline-none"
            />
          ))}
          <button disabled={loading} className="w-full bg-ink text-white py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-gold">
            {loading ? "Creating..." : "Create agency"}
          </button>
        </form>
        <p className="text-center text-[10px] font-black uppercase tracking-widest text-slate-400 mt-6">
          Already registered? <Link href="/login" className="text-[#996515]">Sign in</Link>
        </p>
      </div>
    </main>
  );
}
