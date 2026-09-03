"use client";

import { useEffect, useState } from "react";
import { Alert, Badge, Button, EmptyState, Input, Select } from "@onetrips/ui";

type Passenger = {
  id: string;
  type: "ADULT" | "CHILD" | "INFANT";
  firstName: string;
  lastName: string;
  nationality: string | null;
  dateOfBirth: string;
  passportExpiry: string;
  passportNumberMasked?: string | null;
  isPreferred?: boolean;
  frequentFlyerNumber?: string | null;
  passportExpiringSoon?: boolean;
};

type Country = { code: string; name: string };

const emptyForm = {
  type: "ADULT" as const,
  firstName: "",
  lastName: "",
  dateOfBirth: "",
  nationality: "",
  passportNumber: "",
  passportExpiry: "",
  frequentFlyerNumber: "",
  isPreferred: false,
};

const TYPE_LABEL: Record<Passenger["type"], string> = {
  ADULT: "Adult",
  CHILD: "Child",
  INFANT: "Infant",
};

function formatDisplayDate(value: string) {
  if (!value) return "";
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString();
}

export default function TravelersPage() {
  const [passengers, setPassengers] = useState<Passenger[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const res = await fetch("/api/account/passengers");
    if (res.ok) setPassengers((await res.json()).passengers);
  };

  useEffect(() => {
    load();
    fetch("/api/catalog/countries")
      .then((res) => res.json())
      .then((data) => setCountries(data.countries ?? []));
  }, []);

  const startEdit = async (id: string) => {
    const res = await fetch(`/api/account/passengers/${id}`);
    const data = await res.json();
    if (!res.ok) {
      setError(data.message || "Unable to load traveler");
      return;
    }
    setEditingId(id);
    setForm({
      type: data.passenger.type,
      firstName: data.passenger.firstName,
      lastName: data.passenger.lastName,
      dateOfBirth: data.passenger.dateOfBirth || "",
      nationality: data.passenger.nationality || "",
      passportNumber: data.passenger.passportNumber || "",
      passportExpiry: data.passenger.passportExpiry || "",
      frequentFlyerNumber: data.passenger.frequentFlyerNumber || "",
      isPreferred: Boolean(data.passenger.isPreferred),
    });
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch(editingId ? `/api/account/passengers/${editingId}` : "/api/account/passengers", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Unable to save traveler");
        return;
      }
      setForm(emptyForm);
      setEditingId(null);
      await load();
    } finally {
      setLoading(false);
    }
  };

  const remove = async (id: string) => {
    await fetch(`/api/account/passengers/${id}`, { method: "DELETE" });
    await load();
  };

  const countryName = (code: string | null) => {
    if (!code) return "Nationality n/a";
    return countries.find((country) => country.code === code)?.name ?? code;
  };

  const fieldClass = "!px-3.5 !py-2.5 !text-sm !font-semibold !border-slate-200";

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-black tracking-tight text-ink">Saved travelers</h1>
        <p className="text-sm text-slate-500">Passports are encrypted at rest and shown masked in the list.</p>
      </header>

      {error ? <Alert>{error}</Alert> : null}

      <form
        id="add-traveler"
        onSubmit={save}
        className="rounded-3xl border border-slate-100 bg-white p-6 md:p-8"
      >
        <div className="grid grid-cols-1 gap-x-5 gap-y-4 md:grid-cols-2">
          <Select
            label="Traveler type"
            className={fieldClass}
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value as typeof form.type })}
          >
            <option value="ADULT">Adult</option>
            <option value="CHILD">Child</option>
            <option value="INFANT">Infant</option>
          </Select>
          <Input
            label="Date of birth"
            type="date"
            className={fieldClass}
            value={form.dateOfBirth}
            onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
          />
          <Input
            label="First name"
            required
            autoComplete="given-name"
            className={fieldClass}
            value={form.firstName}
            onChange={(e) => setForm({ ...form, firstName: e.target.value })}
          />
          <Input
            label="Last name"
            required
            autoComplete="family-name"
            className={fieldClass}
            value={form.lastName}
            onChange={(e) => setForm({ ...form, lastName: e.target.value })}
          />
          <Select
            label="Nationality"
            className={fieldClass}
            value={form.nationality}
            onChange={(e) => setForm({ ...form, nationality: e.target.value })}
          >
            <option value="">Select nationality</option>
            {countries.map((country) => (
              <option key={country.code} value={country.code}>
                {country.name}
              </option>
            ))}
          </Select>
          <Input
            label="Passport number"
            autoComplete="off"
            className={fieldClass}
            value={form.passportNumber}
            onChange={(e) => setForm({ ...form, passportNumber: e.target.value })}
          />
          <Input
            label="Passport expiry"
            type="date"
            className={fieldClass}
            value={form.passportExpiry}
            onChange={(e) => setForm({ ...form, passportExpiry: e.target.value })}
          />
          <Input
            label="Frequent flyer number"
            autoComplete="off"
            className={fieldClass}
            value={form.frequentFlyerNumber}
            onChange={(e) => setForm({ ...form, frequentFlyerNumber: e.target.value })}
          />
          <label className="flex items-center gap-3 pt-1 text-sm font-medium text-ink md:col-span-2">
            <input
              type="checkbox"
              checked={form.isPreferred}
              onChange={(e) => setForm({ ...form, isPreferred: e.target.checked })}
              className="size-4 shrink-0 accent-[#996515]"
            />
            Preferred traveler
          </label>
          <div className="flex flex-col gap-3 sm:flex-row md:col-span-2">
            <Button type="submit" disabled={loading} className="min-h-12 w-full px-8 sm:w-auto">
              {loading ? "Saving..." : editingId ? "Update traveler" : "Add traveler"}
            </Button>
            {editingId && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setEditingId(null);
                  setForm(emptyForm);
                }}
                className="min-h-12 w-full border border-slate-100 px-8 text-slate-400 sm:w-auto"
              >
                Cancel
              </Button>
            )}
          </div>
        </div>
      </form>

      {passengers.length === 0 ? (
        <div className="rounded-2xl border border-slate-100 bg-white px-6 py-8 md:px-8 md:py-10">
          <EmptyState
            plain
            title="No saved travelers"
            description="Save traveler information to make future bookings faster."
            action={
              <a
                href="#add-traveler"
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-ink px-6 py-2.5 text-xs font-black uppercase tracking-widest text-white"
              >
                Add Traveler
              </a>
            }
          />
        </div>
      ) : (
        <div className="space-y-3">
          {passengers.map((passenger) => (
            <article
              key={passenger.id}
              className="flex flex-col gap-4 rounded-2xl border border-slate-100 bg-white p-5 md:flex-row md:items-start md:justify-between md:p-6"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-black tracking-tight text-ink">
                    {passenger.firstName} {passenger.lastName}
                  </h2>
                  {passenger.isPreferred ? <Badge tone="gold">Preferred</Badge> : null}
                  {passenger.passportExpiringSoon ? <Badge tone="danger">Passport expires soon</Badge> : null}
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-sm font-medium text-slate-600 sm:grid-cols-3">
                  <div>
                    <dt className="text-[10px] font-black uppercase tracking-widest text-slate-400">Traveler type</dt>
                    <dd className="mt-1">{TYPE_LABEL[passenger.type]}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-black uppercase tracking-widest text-slate-400">Nationality</dt>
                    <dd className="mt-1">{countryName(passenger.nationality)}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-black uppercase tracking-widest text-slate-400">Passport</dt>
                    <dd className="mt-1">{passenger.passportNumberMasked || "No passport"}</dd>
                  </div>
                  {passenger.dateOfBirth ? (
                    <div>
                      <dt className="text-[10px] font-black uppercase tracking-widest text-slate-400">Date of birth</dt>
                      <dd className="mt-1">{formatDisplayDate(passenger.dateOfBirth)}</dd>
                    </div>
                  ) : null}
                  {passenger.passportExpiry ? (
                    <div>
                      <dt className="text-[10px] font-black uppercase tracking-widest text-slate-400">Passport expiry</dt>
                      <dd className="mt-1">{formatDisplayDate(passenger.passportExpiry)}</dd>
                    </div>
                  ) : null}
                  {passenger.frequentFlyerNumber ? (
                    <div>
                      <dt className="text-[10px] font-black uppercase tracking-widest text-slate-400">Frequent flyer</dt>
                      <dd className="mt-1">{passenger.frequentFlyerNumber}</dd>
                    </div>
                  ) : null}
                </dl>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={() => startEdit(passenger.id)}
                  className="inline-flex min-h-11 items-center rounded-xl px-3 text-[10px] font-black uppercase tracking-widest text-[#996515] hover:bg-[#d4af37]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => remove(passenger.id)}
                  className="inline-flex min-h-11 items-center rounded-xl px-3 text-[10px] font-black uppercase tracking-widest text-red-500 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-200"
                >
                  Remove
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
