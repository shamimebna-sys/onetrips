"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Alert, Button, Input, Select } from "@onetrips/ui";

type Country = { code: string; name: string };

export default function WelcomePage() {
  const router = useRouter();
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    dateOfBirth: "",
    gender: "UNSPECIFIED",
    nationality: "",
  });

  useEffect(() => {
    fetch("/api/account/profile")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data?.profile) {
          router.push("/login/customer");
          return;
        }
        setForm((current) => ({
          ...current,
          firstName: data.profile.firstName,
          lastName: data.profile.lastName,
          dateOfBirth: data.profile.dateOfBirth || "",
          gender: data.profile.gender || "UNSPECIFIED",
          nationality: data.profile.nationality || "",
        }));
      });
    fetch("/api/catalog/countries")
      .then((res) => res.json())
      .then((data) => setCountries(data.countries ?? []));
  }, [router]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/account/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.message || "Unable to save profile.");
      setLoading(false);
      return;
    }
    router.push("/account");
  };

  return (
    <main className="mx-auto max-w-xl px-6 py-16">
      <p className="mb-3 text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Welcome to ONETRIPS</p>
      <h1 className="mb-3 text-3xl font-black uppercase tracking-tighter">Complete your profile</h1>
      <p className="mb-8 text-sm font-medium text-slate-500">
        Optional details speed up checkout. You can skip this and book right away.
      </p>
      {error ? <Alert>{error}</Alert> : null}
      <form onSubmit={save} className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <Input label="First name" required value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
          <Input label="Last name" required value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
        </div>
        <Input label="Date of birth" type="date" value={form.dateOfBirth} onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })} />
        <Select label="Gender" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
          <option value="UNSPECIFIED">Prefer not to say</option>
          <option value="MALE">Male</option>
          <option value="FEMALE">Female</option>
        </Select>
        <Select label="Nationality" value={form.nationality} onChange={(e) => setForm({ ...form, nationality: e.target.value })}>
          <option value="">Select nationality</option>
          {countries.map((country) => (
            <option key={country.code} value={country.code}>
              {country.name}
            </option>
          ))}
        </Select>
        <Button type="submit" disabled={loading} className="w-full py-4">
          {loading ? "Saving..." : "Continue"}
        </Button>
        <button
          type="button"
          data-testid="welcome-skip"
          onClick={() => router.push("/account")}
          className="w-full text-center text-[10px] font-black uppercase tracking-widest text-slate-400"
        >
          Skip for now
        </button>
      </form>
    </main>
  );
}
