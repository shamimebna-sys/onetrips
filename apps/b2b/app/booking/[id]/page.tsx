"use client";

import { AgencyShell } from "../../components/AgencyShell";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

type PassengerForm = {
  type: "ADULT" | "CHILD" | "INFANT";
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  nationality: string;
  passportNumber: string;
  passportExpiry: string;
};

type Booking = {
  id: string;
  bookingRef: string;
  status: string;
  type?: string;
  totalAmount: number;
  currency: string;
  providerRef: string | null;
  organization: { id: string; name: string } | null;
  contact: { email?: string; phone?: string } | null;
  hotel?: {
    name: string;
    city: string;
    checkIn: string;
    checkOut: string;
    nights: number;
    room: { name: string };
    board: string;
  } | null;
  next: {
    canAcceptPrice: boolean;
    canSavePassengers: boolean;
    canPay: boolean;
    paid?: boolean;
    ticketed?: boolean;
    searchAgain: boolean;
  };
  request: { adults: number; children: number; infants: number };
  offer: {
    cabinLabel: string;
    brandedFare: string;
    previousTotal?: number;
    fare: { totalLabel: string };
    itineraries?: Array<{
      durationLabel: string;
      stopsLabel: string;
      segments: Array<{
        origin: string;
        destination: string;
        departureTime: string;
        arrivalTime: string;
        airlineName: string;
        flightNumber: string;
      }>;
    }>;
  } | null;
  passengers: Array<{ id: string; type: string; firstName: string; lastName: string }>;
  payments?: Array<{ id: string; status: string; method: string | null; amount: number }>;
  tickets?: Array<{ ticketNumber: string; pdfUrl: string }>;
  invoices?: Array<{ invoiceNo: string; status: string; total: number; pdfUrl: string }>;
};

function slotsFor(request: Booking["request"]): PassengerForm[] {
  const rows: PassengerForm[] = [];
  const push = (type: PassengerForm["type"], count: number) => {
    for (let i = 0; i < count; i += 1) {
      rows.push({ type, firstName: "", lastName: "", dateOfBirth: "", nationality: "", passportNumber: "", passportExpiry: "" });
    }
  };
  push("ADULT", request.adults);
  push("CHILD", request.children);
  push("INFANT", request.infants);
  return rows;
}

export default function AgencyBookingPage() {
  const params = useParams<{ id: string }>();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [wallet, setWallet] = useState<{ available: number; currency: string } | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [countries, setCountries] = useState<Array<{ code: string; name: string }>>([]);
  const [passengers, setPassengers] = useState<PassengerForm[]>([]);
  const [contact, setContact] = useState({ email: "", phone: "" });
  const autoIssued = useRef(false);

  const load = async () => {
    const res = await fetch(`/api/bookings/${params.id}`);
    const data = await res.json();
    if (!res.ok) {
      setError(data.message || "Booking not found");
      setBooking(null);
      return;
    }
    setBooking(data.booking);
    setContact({
      email: data.booking.contact?.email || "",
      phone: data.booking.contact?.phone || "",
    });
    if (data.booking.status === "PASSENGER_PENDING") {
      setPassengers((current) =>
        current.some((row) => row.firstName || row.lastName || row.dateOfBirth)
          ? current
          : slotsFor(data.booking.request),
      );
    }
  };

  useEffect(() => {
    Promise.all([
      load(),
      fetch("/api/catalog/countries").then((res) => res.json()),
      fetch("/api/wallet").then((res) => (res.ok ? res.json() : { wallet: null })),
    ])
      .then(([, countryData, walletData]) => {
        setCountries(countryData.countries ?? []);
        if (walletData.wallet) setWallet({ available: walletData.wallet.available, currency: walletData.wallet.currency });
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  useEffect(() => {
    if (!booking) return;
    if (booking.status === "TICKETED" || booking.status === "UNAVAILABLE" || booking.status === "EXPIRED") return;
    const timer = setInterval(() => { void load(); }, 4000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id, booking?.status]);

  const acceptPrice = async () => {
    setSaving(true);
    setError("");
    const res = await fetch(`/api/bookings/${params.id}/accept-price`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) setError(data.message || "Unable to accept fare");
    else {
      setBooking(data.booking);
      if (data.booking.status === "PASSENGER_PENDING") setPassengers(slotsFor(data.booking.request));
    }
    setSaving(false);
  };

  const submitPassengers = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    const res = await fetch(`/api/bookings/${params.id}/passengers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactEmail: contact.email, contactPhone: contact.phone, passengers }),
    });
    const data = await res.json();
    if (!res.ok) setError(data.message || "Unable to save travelers");
    else setBooking(data.booking);
    setSaving(false);
  };

  const payWallet = async () => {
    setSaving(true);
    setError("");
    const res = await fetch(`/api/bookings/${params.id}/pay`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    const data = await res.json();
    if (!res.ok) setError(data.message || "Wallet authorization failed");
    else setBooking(data.booking);
    setSaving(false);
  };

  const issueTickets = async () => {
    setSaving(true);
    setError("");
    const res = await fetch(`/api/bookings/${params.id}/tickets`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) setError(data.message || "Unable to issue tickets");
    else setBooking(data.booking);
    setSaving(false);
  };

  useEffect(() => {
    if (!booking) return;
    if (autoIssued.current) return;
    if (booking.status !== "BOOKED" && booking.status !== "TICKETING_PENDING") return;
    autoIssued.current = true;
    void issueTickets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booking?.status]);

  const statusLabel = useMemo(() => {
    const map: Record<string, string> = {
      REVALIDATING: "Checking fare",
      PRICE_CHANGED: "Price changed",
      PASSENGER_PENDING: "Traveler details",
      PAYMENT_PENDING: "Wallet authorization",
      PAYMENT_FAILED: "Wallet declined",
      PAYMENT_PROCESSING: "Debiting wallet",
      BOOKED: "Issuing tickets",
      TICKETING_PENDING: "Issuing tickets",
      TICKETED: "Ticketed",
    };
    return booking ? map[booking.status] ?? booking.status : "";
  }, [booking]);

  if (loading) {
    return <AgencyShell><main className="p-8">Loading booking…</main></AgencyShell>;
  }

  return (
    <AgencyShell>
      <main className="p-8 max-w-5xl space-y-6">
        <div className="flex justify-between items-end">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-2">Booking {booking?.bookingRef}</p>
            <h1 className="text-3xl font-black uppercase tracking-tighter text-ink">{statusLabel}</h1>
          </div>
          <Link href="/bookings" className="text-[10px] font-black uppercase tracking-widest text-slate-400">All bookings</Link>
        </div>
        {error && <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-[10px] font-black uppercase">{error}</div>}
        {booking && (
          <>
            <div className="bg-white border border-slate-100 rounded-[2rem] p-8">
              <p className="text-sm text-slate-500 font-medium">
                {booking.organization?.name} · {booking.offer?.fare.totalLabel} · PNR {booking.providerRef || "pending"}
              </p>
              <div className="mt-6 space-y-3">
                {booking.type === "HOTEL" && booking.hotel ? (
                  <div className="border border-slate-100 rounded-3xl p-5">
                    <p className="font-black uppercase">{booking.hotel.name}</p>
                    <p className="text-sm font-medium py-1">
                      {booking.hotel.room.name} · {booking.hotel.board} · {booking.hotel.checkIn} to {booking.hotel.checkOut}
                    </p>
                  </div>
                ) : (
                  booking.offer?.itineraries?.map((itinerary, index) => (
                  <div key={index} className="border border-slate-100 rounded-3xl p-5">
                    {itinerary.segments.map((leg) => (
                      <p key={leg.flightNumber} className="text-sm font-medium py-1">
                        {leg.airlineName} {leg.flightNumber} · {leg.departureTime} {leg.origin} → {leg.arrivalTime} {leg.destination}
                      </p>
                    ))}
                  </div>
                  ))
                )}
              </div>
            </div>

            {booking.next.canAcceptPrice && (
              <div className="bg-white border border-slate-100 rounded-[2rem] p-8">
                <h2 className="text-xl font-black uppercase tracking-tighter mb-2">Supplier fare changed</h2>
                <p className="text-sm text-slate-500 mb-6">
                  Previous {booking.offer?.previousTotal?.toLocaleString()} {booking.currency}. New total {booking.offer?.fare.totalLabel}.
                </p>
                <button onClick={acceptPrice} disabled={saving} className="bg-ink text-white px-6 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-gold">
                  Accept new fare
                </button>
              </div>
            )}

            {booking.next.canSavePassengers && (
              <form onSubmit={submitPassengers} className="bg-white border border-slate-100 rounded-[2rem] p-8 space-y-6">
                <h2 className="text-xl font-black uppercase tracking-tighter">Passengers</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input className="bg-muted p-4 rounded-2xl font-bold outline-none" placeholder="Contact email" value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} />
                  <input className="bg-muted p-4 rounded-2xl font-bold outline-none" placeholder="Contact phone" value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} />
                </div>
                {passengers.map((passenger, index) => (
                  <div key={`${passenger.type}-${index}`} className="border border-slate-100 rounded-3xl p-5 grid grid-cols-1 md:grid-cols-2 gap-3">
                    <p className="md:col-span-2 text-[10px] font-black uppercase tracking-widest text-slate-400">{passenger.type} {index + 1}</p>
                    <input required placeholder="First name" className="bg-muted p-4 rounded-2xl font-bold outline-none" value={passenger.firstName} onChange={(e) => setPassengers((rows) => rows.map((row, i) => i === index ? { ...row, firstName: e.target.value } : row))} />
                    <input required placeholder="Last name" className="bg-muted p-4 rounded-2xl font-bold outline-none" value={passenger.lastName} onChange={(e) => setPassengers((rows) => rows.map((row, i) => i === index ? { ...row, lastName: e.target.value } : row))} />
                    <input required type="date" className="bg-muted p-4 rounded-2xl font-bold outline-none" value={passenger.dateOfBirth} onChange={(e) => setPassengers((rows) => rows.map((row, i) => i === index ? { ...row, dateOfBirth: e.target.value } : row))} />
                    <select required className="bg-muted p-4 rounded-2xl font-bold outline-none" value={passenger.nationality} onChange={(e) => setPassengers((rows) => rows.map((row, i) => i === index ? { ...row, nationality: e.target.value } : row))}>
                      <option value="">Nationality</option>
                      {countries.map((country) => <option key={country.code} value={country.code}>{country.name}</option>)}
                    </select>
                    <input placeholder="Passport number" className="bg-muted p-4 rounded-2xl font-bold outline-none" value={passenger.passportNumber} onChange={(e) => setPassengers((rows) => rows.map((row, i) => i === index ? { ...row, passportNumber: e.target.value } : row))} />
                    <input type="date" className="bg-muted p-4 rounded-2xl font-bold outline-none" value={passenger.passportExpiry} onChange={(e) => setPassengers((rows) => rows.map((row, i) => i === index ? { ...row, passportExpiry: e.target.value } : row))} />
                  </div>
                ))}
                <button disabled={saving} className="w-full bg-ink text-white py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-gold">
                  Continue to wallet charge
                </button>
              </form>
            )}

            {booking.next.canPay && (
              <div className="bg-white border border-slate-100 rounded-[2rem] p-8 space-y-4">
                <h2 className="text-xl font-black uppercase tracking-tighter">Wallet / credit</h2>
                <p className="text-sm text-slate-500">
                  Charge {booking.offer?.fare.totalLabel} from the authenticated organization wallet. Amount is taken from the server-side quote, not the browser.
                </p>
                {wallet && <p className="text-sm font-bold">Available {wallet.currency} {wallet.available.toLocaleString()}</p>}
                <button onClick={payWallet} disabled={saving} className="w-full bg-ink text-white py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-gold">
                  {saving ? "Authorizing…" : booking.status === "PAYMENT_FAILED" ? "Retry wallet debit" : "Debit wallet and issue tickets"}
                </button>
              </div>
            )}

            {booking.status === "TICKETED" && (
              <div className="bg-white border border-slate-100 rounded-[2rem] p-8 space-y-4">
                <h2 className="text-xl font-black uppercase tracking-tighter">Ticketed</h2>
                <p className="text-sm text-slate-500">PNR {booking.providerRef}. Settlement: organization wallet debit.</p>
                {(booking.tickets ?? []).map((ticket) => (
                  <a key={ticket.ticketNumber} href={ticket.pdfUrl} className="block bg-ink text-white text-center py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest">
                    Ticket {ticket.ticketNumber}
                  </a>
                ))}
                {(booking.invoices ?? []).map((invoice) => (
                  <a key={invoice.invoiceNo} href={invoice.pdfUrl} className="block border border-slate-200 text-center py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest">
                    Invoice {invoice.invoiceNo}
                  </a>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </AgencyShell>
  );
}
