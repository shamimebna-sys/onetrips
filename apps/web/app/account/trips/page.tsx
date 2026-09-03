"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BookingStatusBadge, EmptyState, SkeletonBlock, Tabs } from "@onetrips/ui";
import { formatMoney, t } from "@onetrips/shared";

type Row = {
  id: string;
  bookingRef: string;
  status: string;
  label?: string;
  group?: "upcoming" | "completed" | "cancelled" | "refunds";
  totalAmount: number;
  currency: string;
  origin?: string;
  destination?: string;
  createdAt: string;
  travelAt?: string | null;
  type?: string;
  airlineCode?: string | null;
  flightNumber?: string | null;
};

const TAB_EMPTY: Record<string, { title: string; description: string }> = {
  upcoming: { title: "No upcoming trips", description: "Search flights or hotels to plan your next journey." },
  completed: { title: "No completed trips", description: "Finished bookings will appear here." },
  cancelled: { title: "No cancelled trips", description: "Cancelled bookings will appear here." },
  refunds: { title: "No refunds", description: "Refund activity from your bookings will appear here." },
};

export default function TripsPage() {
  const [bookings, setBookings] = useState<Row[] | null>(null);
  const [tab, setTab] = useState("upcoming");
  const [locale, setLocale] = useState("en");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/account/bookings")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => setBookings(data.bookings ?? []))
      .catch(() => {
        setBookings([]);
        setError("Unable to load trips right now.");
      });
    fetch("/api/account/preferences")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.preference?.locale) setLocale(data.preference.locale);
      });
  }, []);

  const rows = useMemo(() => (bookings ?? []).filter((row) => (row.group ?? "upcoming") === tab), [bookings, tab]);

  if (bookings === null) return <SkeletonBlock rows={4} />;

  const empty = TAB_EMPTY[tab] ?? TAB_EMPTY.upcoming;
  const emptyTitle = bookings.length === 0 ? "No trips yet" : empty.title;
  const emptyDescription = bookings.length === 0 ? "Your flights and hotel bookings will appear here." : empty.description;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight text-navy">{t("nav.trips", locale)}</h1>
      {error ? (
        <p className="rounded-2xl bg-red-50 p-4 text-sm font-medium text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      <Tabs
        ariaLabel="Trip status"
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "upcoming", label: "Upcoming" },
          { id: "completed", label: "Completed" },
          { id: "cancelled", label: "Cancelled" },
          { id: "refunds", label: "Refunds" },
        ]}
      />
      {rows.length === 0 ? (
        <EmptyState
          title={emptyTitle}
          description={emptyDescription}
          action={
            <div className="flex flex-wrap justify-center gap-3">
              <Link href="/flights" className="rounded-xl bg-navy px-5 py-3 text-xs font-bold text-white">
                Explore Flights
              </Link>
              <Link href="/hotels" className="rounded-xl border border-line px-5 py-3 text-xs font-semibold text-navy">
                Explore Hotels
              </Link>
            </div>
          }
        />
      ) : null}
      {rows.map((row) => {
        const isHotel = row.type === "HOTEL";
        const showFlight = !isHotel && Boolean(row.airlineCode) && row.airlineCode !== "HT";
        return (
          <article
            key={row.id}
            data-testid="account-booking"
            className="flex flex-col justify-between gap-4 rounded-2xl border border-line bg-white p-5 md:flex-row md:items-center md:p-6"
          >
            <div className="min-w-0">
              <p className="text-xl font-bold tracking-tight text-navy">
                {row.origin || "Trip"} → {row.destination || ""}
              </p>
              <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm font-medium text-copy-muted sm:grid-cols-3">
                <div>
                  <dt className="text-[10px] font-semibold uppercase tracking-widest text-copy-muted">Type</dt>
                  <dd>{isHotel ? "Hotel" : "Flight"}</dd>
                </div>
                <div>
                  <dt className="text-[10px] font-semibold uppercase tracking-widest text-copy-muted">Travel date</dt>
                  <dd>{row.travelAt ? new Date(row.travelAt).toLocaleDateString() : "—"}</dd>
                </div>
                {showFlight ? (
                  <div data-testid="trip-flight">
                    <dt className="text-[10px] font-semibold uppercase tracking-widest text-copy-muted">Airline / flight</dt>
                    <dd>
                      {row.airlineCode}
                      {row.flightNumber ? ` ${row.flightNumber}` : ""}
                    </dd>
                  </div>
                ) : null}
                <div>
                  <dt className="text-[10px] font-semibold uppercase tracking-widest text-copy-muted">Reference</dt>
                  <dd className="uppercase tracking-widest">{row.bookingRef}</dd>
                </div>
              </dl>
              <div className="mt-3">
                <BookingStatusBadge label={row.label ?? row.status} group={row.group} />
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-start gap-3 md:items-end">
              <p className="font-bold text-navy">{formatMoney(row.totalAmount, row.currency, locale)}</p>
              <Link
                href={`/booking/${row.id}`}
                className="inline-flex min-h-11 items-center rounded-xl bg-navy px-5 text-sm font-bold text-white"
              >
                View Trip
              </Link>
            </div>
          </article>
        );
      })}
    </div>
  );
}
