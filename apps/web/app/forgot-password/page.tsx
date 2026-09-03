"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, Button, Input } from "@onetrips/ui";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [devCode, setDevCode] = useState("");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/password/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Unable to send a reset code.");
        return;
      }
      if (data.devCode) {
        sessionStorage.setItem("ot-dev-otp", data.devCode);
        setDevCode(data.devCode);
      }
      router.push(`/reset-password?email=${encodeURIComponent(email)}`);
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <h1 className="mb-3 text-3xl font-black uppercase tracking-tighter">Forgot password</h1>
      <p className="mb-8 text-sm font-medium text-slate-500">
        Enter your email. If an account exists, we will send a 6-digit code.
      </p>
      {error ? <Alert>{error}</Alert> : null}
      {devCode ? (
        <p className="mb-4 text-center text-[10px] font-black uppercase tracking-widest text-[#996515]" data-testid="dev-otp">
          Dev code {devCode}
        </p>
      ) : null}
      <form onSubmit={submit} className="space-y-5">
        <Input label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} data-testid="forgot-email" />
        <Button type="submit" disabled={loading} className="w-full py-4" data-testid="forgot-submit">
          {loading ? "Sending..." : "Send code"}
        </Button>
      </form>
      <p className="mt-8 text-center text-[10px] font-black uppercase tracking-widest text-slate-400">
        <Link href="/login/customer" className="text-gold-dark">
          Back to login
        </Link>
      </p>
    </main>
  );
}
