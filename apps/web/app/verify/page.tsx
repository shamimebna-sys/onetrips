"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Alert, Button, Input } from "@onetrips/ui";

function VerifyInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [otp, setOtp] = useState("");
  const [devCode, setDevCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    const stored = sessionStorage.getItem("ot-dev-otp");
    if (stored) setDevCode(stored);
  }, []);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  const verify = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ destination: email, purpose: "REGISTER", code: otp }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Invalid code");
        return;
      }
      sessionStorage.removeItem("ot-dev-otp");
      router.push("/welcome");
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    if (resendIn > 0) return;
    setError("");
    const res = await fetch("/api/auth/otp/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ destination: email, channel: "EMAIL", purpose: "REGISTER" }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.message || "Unable to resend code.");
      return;
    }
    if (data.devCode) {
      sessionStorage.setItem("ot-dev-otp", data.devCode);
      setDevCode(data.devCode);
    }
    setResendIn(60);
  };

  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <h1 className="mb-3 text-3xl font-black uppercase tracking-tighter">Verify email</h1>
      <p className="mb-8 text-sm font-medium text-slate-500">Enter the 6-digit code sent to {email || "your email"}.</p>
      {error ? <Alert>{error}</Alert> : null}
      {devCode ? (
        <p className="mb-4 text-center text-[10px] font-black uppercase tracking-widest text-[#996515]" data-testid="dev-otp">
          Dev code {devCode}
        </p>
      ) : null}
      <form onSubmit={verify} className="space-y-5">
        <Input label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input
          label="Verification code"
          inputMode="numeric"
          maxLength={6}
          required
          value={otp}
          onChange={(e) => setOtp(e.target.value)}
          data-testid="otp-input"
        />
        <Button type="submit" disabled={loading} className="w-full py-4">
          {loading ? "Verifying..." : "Verify email"}
        </Button>
      </form>
      <button
        type="button"
        onClick={resend}
        disabled={resendIn > 0}
        className="mt-6 w-full text-center text-[10px] font-black uppercase tracking-widest text-gold-dark disabled:text-slate-300"
      >
        {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend code"}
      </button>
      <p className="mt-8 text-center text-[10px] font-black uppercase tracking-widest text-slate-400">
        <Link href="/signup">Back to signup</Link>
      </p>
    </main>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={<div className="flex min-h-[40vh] items-center justify-center">Loading</div>}>
      <VerifyInner />
    </Suspense>
  );
}
