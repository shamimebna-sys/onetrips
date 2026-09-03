"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (res.ok) {
        if (data.user?.type === "CUSTOMER") router.push("/account");
        else router.push("/dashboard");
      } else {
        setError(data.message || data.error || "Invalid credentials");
      }
    } catch (err) {
      setError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-4 font-sans">
      
      {/* 1. TOP NAVBAR (Corrected: No Blue) */}
      <nav className="fixed top-0 left-0 w-full bg-white/80 backdrop-blur-md border-b border-gray-100 z-50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex justify-between items-center">
          <div className="flex items-center">
            <h1 className="text-2xl font-black tracking-tighter">
              <span className="text-[#0F172A]">one</span>
              <span className="text-[#d4af37]">trips</span>
            </h1>
          </div>
          <div className="hidden md:flex space-x-8 text-[11px] font-black uppercase tracking-widest text-gray-500">
            <Link href="/" className="hover:text-[#d4af37]">Flights</Link>
            <Link href="/" className="hover:text-[#d4af37]">Hotels</Link>
            <Link href="/" className="hover:text-[#d4af37]">Visa</Link>
            <Link href="/" className="hover:text-[#d4af37]">Offers</Link>
          </div>
          <div className="flex items-center space-x-6">
            <Link href="/login" className="text-[11px] font-black uppercase tracking-widest text-[#0F172A]">Login</Link>
            {/* Blue removed, now Navy Black */}
            <Link href="/register">
              <button className="bg-[#0F172A] text-white text-[10px] font-black uppercase tracking-[0.2em] px-8 py-3 rounded-full hover:bg-[#d4af37] transition-all shadow-lg shadow-black/10">
                Sign Up
              </button>
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-[480px] w-full mt-24">
        {/* Header - Matching SS exactly */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-black tracking-tighter flex justify-center items-center">
            <span className="text-[#0F172A]">one</span>
            <span className="text-[#d4af37]">trips</span>
          </h1>
          <p className="text-gray-400 mt-2 text-[9px] font-bold uppercase tracking-[0.3em]">
            All In One Travel Solution
          </p>
          <div className="h-[2px] w-10 bg-[#d4af37] mx-auto mt-6 mb-6"></div>
          <h2 className="text-2xl font-black text-[#0F172A] uppercase tracking-tight">
            Agent Login
          </h2>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-3">
            Agency workspace:{" "}
            <a href={process.env.NEXT_PUBLIC_B2B_URL || "http://localhost:3002"} className="text-[#996515]">
              Open B2B portal
            </a>
          </p>
        </div>

        {/* Card Style */}
        <div className="bg-white rounded-[45px] shadow-[0_20px_80px_rgba(15,23,42,0.06)] p-12 border border-gray-50">
          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-2xl mb-8 text-[10px] text-center font-black border border-red-100 uppercase tracking-widest">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-7">
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.25em] mb-3 ml-2">
                Official Email
              </label>
              <input
                type="email"
                required
                className="w-full px-7 py-5 rounded-2xl bg-[#F0F5FA] border border-transparent focus:border-[#d4af37] focus:bg-white outline-none transition-all text-[#0F172A] font-bold text-sm"
                placeholder="agent@onetrips.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-3 ml-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.25em]">
                  Password
                </label>
                <Link href="/contact" className="text-[9px] font-black text-[#d4af37] hover:text-[#0F172A] transition uppercase">
                  Forgot?
                </Link>
              </div>
              <input
                type="password"
                required
                className="w-full px-7 py-5 rounded-2xl bg-[#F0F5FA] border border-transparent focus:border-[#d4af37] focus:bg-white outline-none transition-all text-[#0F172A] font-bold text-sm"
                placeholder="••••••••"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
            </div>

            {/* LOGIN BUTTON: Black to Golden Hover */}
            <button
              type="submit"
              disabled={loading}
              className={`w-full py-5 rounded-2xl font-black text-[11px] tracking-[0.35em] transition-all transform active:scale-[0.98] shadow-2xl shadow-[#0F172A]/20 ${
                loading 
                  ? "bg-gray-100 text-gray-300 cursor-not-allowed" 
                  : "bg-[#0F172A] hover:bg-[#d4af37] text-white"
              }`}
            >
              {loading ? "VERIFYING..." : "SIGN IN"}
            </button>
          </form>

          <div className="mt-12 text-center">
            <p className="text-gray-400 text-[10px] font-black uppercase tracking-[0.25em]">
              New Agent?{" "}
              <Link href="/register" className="text-[#d4af37] hover:text-[#0F172A] transition font-black ml-1 underline decoration-2 underline-offset-8">
                Register Here
              </Link>
            </p>
            <p className="mt-4 text-gray-400 text-[10px] font-black uppercase tracking-[0.25em]">
              Traveler?{" "}
              <Link href="/login/customer" className="text-[#d4af37] underline decoration-2 underline-offset-8">
                Customer Login
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}