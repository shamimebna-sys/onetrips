"use client";

import { useEffect, useState } from "react";
import { Alert, Button, Input } from "@onetrips/ui";

export default function SecurityPage() {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [password, setPassword] = useState({ currentPassword: "", newPassword: "" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/account/profile")
      .then((res) => res.json())
      .then((data) => {
        if (data.profile) {
          setPhone(data.profile.phone || "");
          setPhoneVerified(Boolean(data.profile.phoneVerified));
        }
      });
  }, []);

  const sendOtp = async () => {
    setError("");
    setMessage("");
    const res = await fetch("/api/account/phone/otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.message || "Unable to send code");
      return;
    }
    setOtpSent(true);
    setMessage("Verification code sent.");
  };

  const verify = async () => {
    setError("");
    const res = await fetch("/api/account/phone/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, code }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.message || "Invalid code");
      return;
    }
    setPhoneVerified(true);
    setOtpSent(false);
    setMessage("Phone verified.");
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");
    const res = await fetch("/api/account/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(password),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.message || "Unable to update password");
      return;
    }
    setPassword({ currentPassword: "", newPassword: "" });
    setMessage("Password updated.");
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-3xl font-black tracking-tight text-ink">Security</h1>
      {error ? <Alert>{error}</Alert> : null}
      {message ? <Alert variant="success">{message}</Alert> : null}

      <section className="bg-white rounded-3xl border border-slate-100 p-8 md:p-10">
        <h2 className="text-2xl font-black tracking-tight mb-2">Phone verification</h2>
        <p className="text-sm text-slate-500 mb-6">
          Status: <span className={phoneVerified ? "text-emerald-600 font-black" : "text-[#996515] font-black"}>{phoneVerified ? "Verified" : "Unverified"}</span>
        </p>
        <div className="space-y-4">
          <Input label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} hint="Used for account recovery and travel alerts." />
          {otpSent ? <Input label="Verification code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} /> : null}
          <Button type="button" onClick={otpSent ? verify : sendOtp}>
            {otpSent ? "Verify code" : "Send verification code"}
          </Button>
        </div>
      </section>

      <section className="bg-white rounded-3xl border border-slate-100 p-8 md:p-10">
        <h2 className="text-2xl font-black tracking-tight mb-6">Change password</h2>
        <form onSubmit={changePassword} className="space-y-4">
          <Input label="Current password" type="password" required value={password.currentPassword} onChange={(e) => setPassword({ ...password, currentPassword: e.target.value })} />
          <Input
            label="New password"
            type="password"
            required
            minLength={8}
            value={password.newPassword}
            onChange={(e) => setPassword({ ...password, newPassword: e.target.value })}
            hint="At least 8 characters with a letter and a number."
          />
          <Button type="submit">Update password</Button>
        </form>
      </section>
    </div>
  );
}
