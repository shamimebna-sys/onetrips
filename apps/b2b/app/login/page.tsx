"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function AgencyLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Invalid credentials");
        return;
      }
      router.push("/");
    } catch {
      setError("Connection error.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-muted flex items-center justify-center px-6">
      <div className="w-full max-w-md bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-[0_20px_80px_rgba(15,23,42,0.06)]">
        <h1 className="text-2xl font-black tracking-tighter mb-2">
          <span className="text-ink">ONE</span>
          <span className="text-gold">TRIPS</span>
        </h1>
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-8">Agency Portal</p>
        {error && <div className="bg-red-50 text-red-600 p-3 rounded-2xl text-[10px] font-black uppercase mb-6">{error}</div>}
        <form onSubmit={submit} className="space-y-4">
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-muted p-4 rounded-2xl font-bold outline-none" placeholder="Agency email" />
          <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-muted p-4 rounded-2xl font-bold outline-none" placeholder="Password" />
          <button disabled={loading} className="w-full bg-ink text-white py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-gold">
            {loading ? "Checking..." : "Sign in"}
          </button>
        </form>
        <p className="text-center text-[10px] font-black uppercase tracking-widest text-slate-400 mt-6">
          New agency? <Link href="/register" className="text-[#996515]">Register</Link>
        </p>
      </div>
    </main>
  );
}
