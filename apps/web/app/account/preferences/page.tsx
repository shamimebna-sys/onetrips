"use client";

import { useEffect, useState } from "react";
import { Alert, Button, Select } from "@onetrips/ui";
import { formatMoney } from "@onetrips/shared";

export default function PreferencesPage() {
  const [form, setForm] = useState({ locale: "en", currency: "BDT", emailOptIn: true, smsOptIn: true, marketingOptIn: false });
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/account/preferences")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.preference) setForm((current) => ({ ...current, ...data.preference }));
      });
  }, []);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const res = await fetch("/api/account/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) setMessage("Preferences saved.");
  };

  return (
    <form onSubmit={save} className="max-w-xl space-y-5 rounded-3xl border border-slate-100 bg-white p-8">
      <h1 className="text-3xl font-black tracking-tight text-ink">Preferences</h1>
      {message ? <Alert variant="success">{message}</Alert> : null}
      <Select label="Language" value={form.locale} onChange={(e) => setForm({ ...form, locale: e.target.value })}>
        <option value="en">English</option>
        <option value="bn">Bangla (coming soon)</option>
      </Select>
      <Select label="Display currency" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
        <option value="BDT">BDT</option>
        <option value="USD">USD</option>
        <option value="EUR">EUR</option>
        <option value="AED">AED</option>
        <option value="SAR">SAR</option>
        <option value="GBP">GBP</option>
      </Select>
      <p className="text-sm font-medium text-slate-500">
        Display example: {formatMoney(15000, form.currency, form.locale)}. Settlement remains the booking currency; this does not convert fares.
      </p>
      <label className="flex gap-3 text-sm font-medium">
        <input type="checkbox" checked={form.emailOptIn} onChange={(e) => setForm({ ...form, emailOptIn: e.target.checked })} />
        Email notifications
      </label>
      <label className="flex gap-3 text-sm font-medium">
        <input type="checkbox" checked={form.smsOptIn} onChange={(e) => setForm({ ...form, smsOptIn: e.target.checked })} />
        SMS notifications
      </label>
      <label className="flex gap-3 text-sm font-medium">
        <input type="checkbox" checked={form.marketingOptIn} onChange={(e) => setForm({ ...form, marketingOptIn: e.target.checked })} />
        Marketing offers
      </label>
      <Button type="submit">Save preferences</Button>
    </form>
  );
}
