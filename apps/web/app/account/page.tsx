"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, Hotel, PlaneTakeoff, Users } from "lucide-react";
import { BookingStatusBadge, EmptyState, SkeletonBlock } from "@onetrips/ui";
import { CustomerSearch } from "@/components/search/CustomerSearch";
import {
  buildFlightSearchParams,
  emptyMultiCitySegments,
} from "@/components/search/flightSearchQuery";
import { type SearchTripType } from "@/components/search/SearchChrome";

type Profile = {
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  phoneVerified: boolean;
  dateOfBirth?: string;
  nationality?: string | null;
  travelerCount: number;
};

type Trip = {
  id: string;
  bookingRef: string;
  status: string;
  label?: string;
  group?: "upcoming" | "completed" | "cancelled" | "refunds";
  origin?: string;
  destination?: string;
  departureAt?: string | null;
  travelAt?: string | null;
  totalAmount: number;
  currency: string;
  type?: string;
  airlineCode?: string | null;
  flightNumber?: string | null;
};

function travelDate(offset = 21) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
}

function greet(name: string) {
  const hour = new Date().getHours();
  const part = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  return `${part}, ${name}`;
}

function profileCompletion(profile: Profile) {
  const checks = [profile.firstName, profile.lastName, profile.email, profile.phoneVerified, profile.dateOfBirth, profile.nationality];
  const done = checks.filter(Boolean).length;
  return Math.round((done / checks.length) * 100);
}

function flightMeta(trip: Trip) {
  if (trip.type === "HOTEL") return null;
  if (!trip.airlineCode || trip.airlineCode === "HT") return null;
  return [trip.airlineCode, trip.flightNumber].filter(Boolean).join(" ");
}

const ACTIONS = [
  { href: "/flights", title: "Search Flights", hint: "Find your next flight", icon: PlaneTakeoff },
  { href: "/hotels", title: "Search Hotels", hint: "Find a place to stay", icon: Hotel },
  { href: "/account/trips", title: "My Trips", hint: "Manage your bookings", icon: CalendarDays },
  { href: "/account/travelers", title: "Travelers", hint: "Manage passenger details", icon: Users },
];

export default function AccountOverviewPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [trips, setTrips] = useState<Trip[] | null>(null);
  const [unread, setUnread] = useState(0);
  const [currency, setCurrency] = useState("BDT");
  const [error, setError] = useState("");
  const [product, setProduct] = useState<"flights" | "hotels">("flights");
  const [tripType, setTripType] = useState<SearchTripType>("round-trip");
  const [origin, setOrigin] = useState("DAC");
  const [destination, setDestination] = useState("DXB");
  const [departureDate, setDepartureDate] = useState(travelDate());
  const [returnDate, setReturnDate] = useState(travelDate(28));
  const [adults, setAdults] = useState("1");
  const [cabin, setCabin] = useState("ECONOMY");
  const [multiCitySegments, setMultiCitySegments] = useState(emptyMultiCitySegments);
  const [hotelCheckIn, setHotelCheckIn] = useState(travelDate());
  const [hotelCheckOut, setHotelCheckOut] = useState(travelDate(24));
  const [hotelRooms, setHotelRooms] = useState("1");
  const [hotelAdults, setHotelAdults] = useState("2");
  const [hotelChildren, setHotelChildren] = useState("0");

  useEffect(() => {
    Promise.all([
      fetch("/api/auth/me").then((res) => (res.ok ? res.json() : null)),
      fetch("/api/account/profile").then((res) => (res.ok ? res.json() : null)),
      fetch("/api/account/bookings").then((res) => (res.ok ? res.json() : { bookings: [] })),
      fetch("/api/account/notifications?unread=1").then((res) => (res.ok ? res.json() : null)),
      fetch("/api/account/preferences").then((res) => (res.ok ? res.json() : null)),
    ])
      .then(([meBody, profileBody, bookingsBody, inboxBody, prefBody]) => {
        setDisplayName(typeof meBody?.user?.displayName === "string" ? meBody.user.displayName : "");
        setProfile(profileBody?.profile ?? null);
        setTrips(bookingsBody?.bookings ?? []);
        if (typeof inboxBody?.unreadCount === "number") setUnread(inboxBody.unreadCount);
        if (prefBody?.preference?.currency) setCurrency(prefBody.preference.currency);
      })
      .catch(() => setError("Unable to load your account right now."));
  }, []);

  const firstName = profile?.firstName?.trim() || displayName.split(/\s+/).filter(Boolean)[0] || "";
  const upcoming = (trips ?? []).find((trip) => trip.group === "upcoming");
  const recent = (trips ?? []).slice(0, 5);

  const swapAirports = () => {
    setOrigin(destination);
    setDestination(origin);
  };

  if (!profile && !error && trips === null) {
    return <SkeletonBlock rows={6} />;
  }

  return (
    <div className="space-y-6">
      {error ? (
        <p className="rounded-2xl bg-red-50 p-4 text-sm font-medium text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      <section>
        <p className="text-sm font-medium text-copy-muted">{firstName ? greet(firstName) : "Welcome back"}</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-navy md:text-3xl">Ready for your next trip?</h1>
      </section>

      <CustomerSearch
        product={product}
        onProductChange={setProduct}
        flights={{
          tripType,
          origin,
          destination,
          departureDate,
          returnDate,
          adults,
          cabin,
          segments: multiCitySegments,
          onTripTypeChange: (id) => {
            setTripType(id);
            if (id === "one-way") setReturnDate("");
            if (id === "round-trip" && !returnDate) setReturnDate(travelDate(28));
          },
          onOrigin: setOrigin,
          onDestination: setDestination,
          onDeparture: setDepartureDate,
          onReturn: setReturnDate,
          onAdults: setAdults,
          onCabin: setCabin,
          onSegments: setMultiCitySegments,
          onSwap: swapAirports,
          onSearch: () => {
            const params = buildFlightSearchParams({
              tripType,
              origin,
              destination,
              departureDate,
              returnDate,
              adults,
              cabin,
              segments: multiCitySegments,
            });
            router.push(`/flights?${params.toString()}`);
          },
          formTestId: "account-flight-search",
          searchTestId: "account-search-flights",
        }}
        hotels={{
          destination,
          checkIn: hotelCheckIn,
          checkOut: hotelCheckOut,
          rooms: hotelRooms,
          adults: hotelAdults,
          children: hotelChildren,
          onDestination: setDestination,
          onCheckIn: setHotelCheckIn,
          onCheckOut: setHotelCheckOut,
          onRooms: setHotelRooms,
          onAdults: setHotelAdults,
          onChildren: setHotelChildren,
          onSearch: () => {
            const params = new URLSearchParams({
              city: destination,
              checkIn: hotelCheckIn,
              checkOut: hotelCheckOut,
              rooms: hotelRooms,
              adults: hotelAdults,
              children: hotelChildren,
            });
            router.push(`/hotels?${params.toString()}`);
          },
          formTestId: "account-hotel-search",
        }}
      />

      <section>
        <h2 className="mb-3 text-base font-bold tracking-tight text-navy">Quick actions</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {ACTIONS.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              aria-label={action.title}
              className="rounded-2xl border border-line bg-white p-4 hover:border-gold-accent hover:bg-gold-soft"
            >
              <action.icon size={18} className="text-gold-accent" />
              <p className="mt-3 text-sm font-semibold text-navy">{action.title}</p>
              <p className="mt-0.5 text-xs font-medium text-copy-muted">{action.hint}</p>
            </Link>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-line bg-white p-5 md:p-6">
          <h2 className="mb-4 text-base font-bold tracking-tight text-navy">Upcoming trip</h2>
          {upcoming ? (
            <TripHighlight trip={upcoming} />
          ) : (
            <EmptyState
              plain
              title="No upcoming trips"
              description="Your next journey is waiting."
              action={
                <div className="flex flex-wrap justify-center gap-3">
                  <Link href="/flights" className="inline-flex min-h-10 items-center rounded-xl bg-navy px-4 text-xs font-bold text-white">
                    Search Flights
                  </Link>
                  <Link href="/hotels" className="inline-flex min-h-10 items-center rounded-xl border border-line px-4 text-xs font-semibold text-navy">
                    Search Hotels
                  </Link>
                </div>
              }
            />
          )}
        </section>
        <section className="rounded-2xl border border-line bg-white p-5 md:p-6">
          <h2 className="mb-4 text-base font-bold tracking-tight text-navy">Recent trips</h2>
          {recent.length === 0 ? (
            <EmptyState
              plain
              title="No trips yet"
              description="Your completed bookings will appear here."
              action={
                <Link href="/flights" className="inline-flex min-h-10 items-center rounded-xl bg-navy px-4 text-xs font-bold text-white">
                  Search Flights
                </Link>
              }
            />
          ) : (
            <ul className="space-y-2">
              {recent.map((trip) => (
                <li key={trip.id}>
                  <Link href={`/booking/${trip.id}`} className="flex items-center justify-between gap-3 rounded-xl border border-line px-4 py-3 hover:border-gold-accent hover:bg-gold-soft">
                    <span>
                      <span className="block font-semibold text-navy">
                        {trip.origin} → {trip.destination}
                      </span>
                      <span className="text-xs font-medium text-copy-muted">
                        {trip.type === "HOTEL" ? "Hotel" : "Flight"}
                        {trip.travelAt ? ` · ${new Date(trip.travelAt).toLocaleDateString()}` : ""}
                        {trip.label ? ` · ${trip.label}` : ""}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs font-semibold text-navy">View trip</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {profile ? (
        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <SummaryCard label="Profile" value={`${profileCompletion(profile)}%`} hint="Completion" />
          <SummaryCard label="Travelers" value={String(profile.travelerCount)} hint="Saved" href="/account/travelers" />
          <SummaryCard label="Notifications" value={String(unread)} hint="Unread" href="/account/notifications" />
          <SummaryCard label="Currency" value={currency} hint="Display only" href="/account/preferences" />
        </section>
      ) : null}
    </div>
  );
}

function TripHighlight({ trip }: { trip: Trip }) {
  const meta = flightMeta(trip);
  return (
    <div>
      <p className="text-2xl font-bold tracking-tight text-navy">
        {trip.origin} → {trip.destination}
      </p>
      <p className="mt-2 text-sm font-medium text-copy-muted">
        {trip.type === "HOTEL" ? "Hotel" : "Flight"}
        {trip.travelAt || trip.departureAt
          ? ` · ${new Date(trip.travelAt || trip.departureAt || "").toLocaleDateString()}`
          : ""}
        {meta ? ` · ${meta}` : ""}
      </p>
      <div className="mt-3">
        <BookingStatusBadge label={trip.label ?? trip.status} group={trip.group} />
      </div>
      <Link
        href={`/booking/${trip.id}`}
        className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-navy px-5 text-sm font-bold text-white"
      >
        View trip
      </Link>
    </div>
  );
}

function SummaryCard({ label, value, hint, href }: { label: string; value: string; hint: string; href?: string }) {
  const inner = (
    <>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-copy-muted">{label}</p>
      <p className="mt-2 text-xl font-bold text-navy">{value}</p>
      <p className="mt-1 text-xs font-medium text-copy-muted">{hint}</p>
    </>
  );
  const className = "rounded-2xl border border-line bg-white p-4";
  return href ? (
    <Link href={href} className={`${className} hover:border-gold-accent`}>
      {inner}
    </Link>
  ) : (
    <div className={className}>{inner}</div>
  );
}
