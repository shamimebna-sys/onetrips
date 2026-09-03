"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Alert, Button, Input } from "@onetrips/ui";

function ResetInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [devCode, setDevCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const stored = sessionStorage.getItem("ot-dev-otp");
    if (stored) setDevCode(stored);
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/password/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Unable to reset password.");
        return;
      }
      sessionStorage.removeItem("ot-dev-otp");
      router.push("/login/customer");
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <h1 className="mb-3 text-3xl font-black uppercase tracking-tighter">Reset password</h1>
      <p className="mb-8 text-sm font-medium text-slate-500">Enter the 6-digit code and choose a new password.</p>
      {error ? <Alert>{error}</Alert> : null}
      {devCode ? (
        <p className="mb-4 text-center text-[10px] font-black uppercase tracking-widest text-[#996515]" data-testid="dev-otp">
          Dev code {devCode}
        </p>
      ) : null}
      <form onSubmit={submit} className="space-y-5">
        <Input label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} data-testid="reset-email" />
        <Input label="Verification code" inputMode="numeric" maxLength={6} required value={code} onChange={(e) => setCode(e.target.value)} data-testid="reset-code" />
        <Input label="New password" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} data-testid="reset-password" />
        <Input label="Confirm password" type="password" required minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} data-testid="reset-confirm" />
        <Button type="submit" disabled={loading} className="w-full py-4" data-testid="reset-submit">
          {loading ? "Saving..." : "Update password"}
        </Button>
      </form>
      <p className="mt-8 text-center text-[10px] font-black uppercase tracking-widest text-slate-400">
        <Link href="/forgot-password" className="text-gold-dark">
          Request a new code
        </Link>
      </p>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="flex min-h-[40vh] items-center justify-center">Loading</div>}>
      <ResetInner />
    </Suspense>
  );
}
