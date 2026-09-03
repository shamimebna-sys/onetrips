"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { isSafeReturnPath } from "@onetrips/shared";
import { ensureCustomerSession } from "@onetrips/ui";

export default function CustomerLoginPage() {
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [otp, setOtp] = useState("");
  const [otpMode, setOtpMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const router = useRouter();

  const finishLogin = (user: { type?: string }) => {
    const next = new URLSearchParams(window.location.search).get("next");
    const safeNext = isSafeReturnPath(next) ? next : null;
    if (user.type === "B2B") router.push("/dashboard");
    else if (user.type === "ADMIN") router.push(process.env.NEXT_PUBLIC_ADMIN_URL || "http://localhost:3001");
    else router.push(safeNext || "/account");
  };

  useEffect(() => {
    let cancelled = false;
    ensureCustomerSession().then((user) => {
      if (cancelled) return;
      if (user) {
        const next = new URLSearchParams(window.location.search).get("next");
        router.replace(isSafeReturnPath(next) ? next : "/account");
        return;
      }
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Invalid credentials");
        return;
      }
      if (data.mfaRequired) {
        setOtpMode(true);
        return;
      }
      finishLogin(data.user);
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ destination: formData.email, purpose: "LOGIN", code: otp }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Invalid code");
        return;
      }
      finishLogin(data.user);
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!ready) return null;

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-4 font-sans py-12">
      <div className="max-w-[480px] w-full">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-black tracking-tighter">
            <span className="text-[#0F172A]">ONE</span>
            <span className="text-[#d4af37]">TRIPS</span>
          </h1>
          <div className="h-[2px] w-10 bg-[#d4af37] mx-auto mt-6 mb-6"></div>
          <h2 className="text-2xl font-black text-[#0F172A] uppercase tracking-tight">
            {otpMode ? "Verify Code" : "Welcome Back"}
          </h2>
        </div>

        <div className="bg-white rounded-[45px] shadow-[0_20px_80px_rgba(15,23,42,0.06)] p-12 border border-gray-50">
          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-2xl mb-8 text-[10px] text-center font-black border border-red-100 uppercase tracking-widest">
              {error}
            </div>
          )}

          {otpMode ? (
            <form onSubmit={handleOtp} className="space-y-7">
              <input
                inputMode="numeric"
                maxLength={6}
                required
                className="w-full px-7 py-5 rounded-2xl bg-[#F0F5FA] text-center tracking-[0.5em] font-black text-lg outline-none focus:border-[#d4af37] border border-transparent"
                placeholder="000000"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
              />
              <button type="submit" disabled={loading} className="w-full py-5 rounded-2xl font-black text-[11px] tracking-[0.35em] bg-[#0F172A] hover:bg-[#d4af37] text-white">
                {loading ? "VERIFYING..." : "VERIFY"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleLogin} className="space-y-7">
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.25em] mb-3 ml-2">Email</label>
                <input
                  type="email"
                  required
                  data-testid="login-email"
                  className="w-full px-7 py-5 rounded-2xl bg-[#F0F5FA] border border-transparent focus:border-[#d4af37] focus:bg-white outline-none font-bold text-sm"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.25em] mb-3 ml-2">Password</label>
                <input
                  type="password"
                  required
                  data-testid="login-password"
                  className="w-full px-7 py-5 rounded-2xl bg-[#F0F5FA] border border-transparent focus:border-[#d4af37] focus:bg-white outline-none font-bold text-sm"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                />
              </div>
              <button type="submit" disabled={loading} data-testid="login-submit" className="w-full py-5 rounded-2xl font-black text-[11px] tracking-[0.35em] bg-[#0F172A] hover:bg-[#d4af37] text-white">
                {loading ? "VERIFYING..." : "SIGN IN"}
              </button>
              <p className="text-center">
                <Link href="/forgot-password" className="text-[10px] font-black uppercase tracking-widest text-[#d4af37]">
                  Forgot password?
                </Link>
              </p>
            </form>
          )}

          <p className="mt-12 text-center text-gray-400 text-[10px] font-black uppercase tracking-[0.25em]">
            Travel agent?{" "}
            <Link href="/login" className="text-[#d4af37] underline decoration-2 underline-offset-8">Agent Login</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
