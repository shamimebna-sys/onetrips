"use client";

import { useEffect, useState } from "react";

type Profile = {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string | null;
  nationality: string | null;
  addressLine1: string;
  addressLine2: string;
  city: string;
  postalCode: string;
  countryId: string;
  photoUrl: string | null;
};

type Country = { code: string; name: string };

export default function ProfilePage() {
  const [form, setForm] = useState<Profile>({
    firstName: "",
    lastName: "",
    dateOfBirth: "",
    gender: "UNSPECIFIED",
    nationality: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    postalCode: "",
    countryId: "",
    photoUrl: null,
  });
  const [countries, setCountries] = useState<Country[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/account/profile")
      .then((res) => res.json())
      .then((data) => {
        if (data.profile) {
          setForm({
            firstName: data.profile.firstName,
            lastName: data.profile.lastName,
            dateOfBirth: data.profile.dateOfBirth || "",
            gender: data.profile.gender || "UNSPECIFIED",
            nationality: data.profile.nationality || "",
            addressLine1: data.profile.addressLine1 || "",
            addressLine2: data.profile.addressLine2 || "",
            city: data.profile.city || "",
            postalCode: data.profile.postalCode || "",
            countryId: data.profile.countryId || "",
            photoUrl: data.profile.photoUrl || null,
          });
        }
      });
    fetch("/api/catalog/countries")
      .then((res) => res.json())
      .then((data) => setCountries(data.countries ?? []));
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Unable to save profile");
        return;
      }
      setMessage("Profile saved.");
    } finally {
      setLoading(false);
    }
  };

  const uploadPhoto = async (file: File) => {
    const body = new FormData();
    body.set("photo", file);
    const res = await fetch("/api/account/photo", { method: "POST", body });
    const data = await res.json();
    if (!res.ok) {
      setError(data.message || "Unable to upload photo");
      return;
    }
    setForm((current) => ({ ...current, photoUrl: data.profile?.photoUrl || "/api/account/photo" }));
    setMessage("Photo updated.");
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-100 p-8 md:p-10 max-w-3xl">
      <h1 className="text-3xl font-black tracking-tight text-ink mb-8">Profile</h1>
      {error && <div className="bg-red-50 text-red-600 p-3 rounded-2xl text-[10px] font-black uppercase mb-4">{error}</div>}
      {message && <div className="bg-emerald-50 text-emerald-700 p-3 rounded-2xl text-[10px] font-black uppercase mb-4">{message}</div>}
      <form onSubmit={save} className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <input required className="bg-slate-50 p-4 rounded-2xl font-bold outline-none" placeholder="First name" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
        <input required className="bg-slate-50 p-4 rounded-2xl font-bold outline-none" placeholder="Last name" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
        <input type="date" className="bg-slate-50 p-4 rounded-2xl font-bold outline-none" value={form.dateOfBirth} onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })} />
        <select className="bg-slate-50 p-4 rounded-2xl font-bold outline-none" value={form.gender ?? "UNSPECIFIED"} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
          <option value="UNSPECIFIED">Prefer not to say</option>
          <option value="MALE">Male</option>
          <option value="FEMALE">Female</option>
        </select>
        <select className="md:col-span-2 bg-slate-50 p-4 rounded-2xl font-bold outline-none" value={form.nationality ?? ""} onChange={(e) => setForm({ ...form, nationality: e.target.value })}>
          <option value="">Nationality</option>
          {countries.map((country) => (
            <option key={country.code} value={country.code}>{country.name}</option>
          ))}
        </select>
        <input className="md:col-span-2 bg-slate-50 p-4 rounded-2xl font-bold outline-none" placeholder="Address line 1" value={form.addressLine1} onChange={(e) => setForm({ ...form, addressLine1: e.target.value })} />
        <input className="md:col-span-2 bg-slate-50 p-4 rounded-2xl font-bold outline-none" placeholder="Address line 2" value={form.addressLine2} onChange={(e) => setForm({ ...form, addressLine2: e.target.value })} />
        <input className="bg-slate-50 p-4 rounded-2xl font-bold outline-none" placeholder="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
        <input className="bg-slate-50 p-4 rounded-2xl font-bold outline-none" placeholder="Postal code" value={form.postalCode} onChange={(e) => setForm({ ...form, postalCode: e.target.value })} />
        <select className="md:col-span-2 bg-slate-50 p-4 rounded-2xl font-bold outline-none" value={form.countryId} onChange={(e) => setForm({ ...form, countryId: e.target.value })}>
          <option value="">Country</option>
          {countries.map((country) => (
            <option key={country.code} value={country.code}>{country.name}</option>
          ))}
        </select>
        <label className="md:col-span-2 text-sm font-medium text-slate-600">
          Profile photo
          {form.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={form.photoUrl} alt="" className="mt-3 h-20 w-20 rounded-2xl object-cover" />
          ) : null}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="mt-3 block w-full text-xs"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void uploadPhoto(file);
            }}
          />
        </label>
        <button disabled={loading} className="md:col-span-2 bg-slate-900 text-white py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-[#d4af37]">
          {loading ? "Saving..." : "Save profile"}
        </button>
      </form>
    </div>
  );
}
