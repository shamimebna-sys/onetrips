"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { Alert, Button, Input } from "@onetrips/ui";

export default function CustomerSignupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    acceptTerms: false,
    acceptPrivacy: false,
    marketingConsent: false,
  });

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (!form.acceptTerms || !form.acceptPrivacy) {
      setError("Please accept the Terms and Privacy Policy.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/register/customer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          phone: form.phone,
          password: form.password,
          acceptTerms: form.acceptTerms,
          acceptPrivacy: form.acceptPrivacy,
          marketingConsent: form.marketingConsent,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Registration failed");
        return;
      }
      if (data.devCode) sessionStorage.setItem("ot-dev-otp", data.devCode);
      router.push(`/verify?email=${encodeURIComponent(form.email)}`);
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-white">
      <section className="px-6 py-12 bg-slate-50">
        <div className="max-w-xl mx-auto bg-white rounded-[3rem] shadow-2xl border border-slate-100 overflow-hidden">
          <div className="bg-slate-900 p-10 text-center">
            <h1 className="text-3xl font-black text-white uppercase tracking-tighter">Create Account</h1>
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-2">
              Verify with a one-time code
            </p>
          </div>
          <div className="p-8 md:p-12">
            {error ? <Alert>{error}</Alert> : null}
            <form onSubmit={handleRegister} className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <Input label="First name" required data-testid="signup-first" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
                <Input label="Last name" required data-testid="signup-last" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
              </div>
              <Input label="Email" type="email" required data-testid="signup-email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              <Input label="Mobile number" type="tel" required data-testid="signup-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              <Input label="Password" type="password" required minLength={8} hint="At least 8 characters with a letter and a number" data-testid="signup-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              <Input label="Confirm password" type="password" required minLength={8} data-testid="signup-confirm" value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} />
              <label className="flex items-start gap-3 text-sm font-medium text-slate-600">
                <input type="checkbox" className="mt-1" checked={form.acceptTerms} onChange={(e) => setForm({ ...form, acceptTerms: e.target.checked })} data-testid="signup-terms" />
                <span>
                  I agree to the{" "}
                  <Link href="/terms" className="font-black text-gold-dark">
                    Terms & Conditions
                  </Link>
                </span>
              </label>
              <label className="flex items-start gap-3 text-sm font-medium text-slate-600">
                <input type="checkbox" className="mt-1" checked={form.acceptPrivacy} onChange={(e) => setForm({ ...form, acceptPrivacy: e.target.checked })} data-testid="signup-privacy" />
                <span>
                  I acknowledge the{" "}
                  <Link href="/privacy" className="font-black text-gold-dark">
                    Privacy Policy
                  </Link>
                </span>
              </label>
              <label className="flex items-start gap-3 text-sm font-medium text-slate-600">
                <input type="checkbox" className="mt-1" checked={form.marketingConsent} onChange={(e) => setForm({ ...form, marketingConsent: e.target.checked })} data-testid="signup-marketing" />
                <span>Send me offers and travel updates (optional)</span>
              </label>
              <Button type="submit" disabled={loading} className="w-full py-6 rounded-3xl" data-testid="signup-submit">
                {loading ? "Creating..." : "Create Account"}
              </Button>
              <p className="text-center text-[10px] font-black uppercase tracking-widest text-slate-400">
                Already have an account?{" "}
                <Link href="/login/customer" className="text-[#996515]">
                  Login
                </Link>
              </p>
              <p className="text-center text-[10px] font-black uppercase tracking-widest text-slate-400">
                Agency partner?{" "}
                <Link href="/register" className="text-[#996515]">
                  Register here
                </Link>
              </p>
            </form>
          </div>
        </div>
      </section>
    </main>
  );
}
