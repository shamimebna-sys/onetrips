"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ensureCustomerSession } from "@onetrips/ui";
import {
  BookingHeader,
  BookingProgress,
  BookingSummaryCard,
  CancelBookingBlock,
  CancelConfirmDialog,
  CheckoutSkeleton,
  ContactSection,
  ErrorBanner,
  FlightSummaryCard,
  PassengersSection,
  PaymentsRefundsPanel,
  PrimaryCta,
  RefundCancellationPanel,
  StatusTimeline,
  StatusPanel,
  StickyMobileCta,
  TravelInformation,
} from "@/components/booking/BookingCheckoutChrome";
import {
  CARD,
  FOCUS,
  holdRemainingMs,
  isActiveFareHold,
  passportRequiredFor,
  progressIndex,
  slotsFor,
  validateTravelerForm,
  type Booking,
  type PassengerForm,
} from "@/components/booking/checkoutModel";

function emptyBooking(): Booking | null {
  return null;
}

export default function BookingCheckoutPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [booking, setBooking] = useState<Booking | null>(emptyBooking());
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [countries, setCountries] = useState<Array<{ code: string; name: string }>>([]);
  const [saved, setSaved] = useState<Array<{ id: string; firstName: string; lastName: string; type: string }>>([]);
  const [passengers, setPassengers] = useState<PassengerForm[]>([]);
  const [contact, setContact] = useState({ email: "", phone: "" });
  const [prefilled, setPrefilled] = useState({ email: false, phone: false });
  const [method, setMethod] = useState<"CARD" | "BKASH" | "NAGAD">("CARD");
  const [promoCode, setPromoCode] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [cancelOpen, setCancelOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const autoIssued = useRef(false);

  const load = async () => {
    const res = await fetch(`/api/bookings/${params.id}`, { credentials: "same-origin" });
    const data = await res.json();
    if (!res.ok) {
      setError(data.message || "Booking not found");
      setBooking(null);
      return;
    }
    setError("");
    setBooking(data.booking);
    setContact({
      email: data.booking.contact?.email || "",
      phone: data.booking.contact?.phone || "",
    });
    setPrefilled({
      email: Boolean(data.booking.contact?.email),
      phone: Boolean(data.booking.contact?.phone),
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
    let cancelled = false;
    autoIssued.current = false;
    (async () => {
      await ensureCustomerSession();
      if (cancelled) return;
      try {
        const [, countryData, travelerData] = await Promise.all([
          load(),
          fetch("/api/catalog/countries", { credentials: "same-origin" }).then((res) => res.json()),
          fetch("/api/account/passengers", { credentials: "same-origin" }).then((res) =>
            res.ok ? res.json() : { passengers: [] },
          ),
        ]);
        if (cancelled) return;
        setCountries(countryData.countries ?? []);
        setSaved(travelerData.passengers ?? []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  useEffect(() => {
    if (!booking) return;
    const poll =
      booking.next.awaitingPayment ||
      booking.status === "PAYMENT_SUCCESS" ||
      booking.status === "BOOKING_PENDING" ||
      booking.status === "BOOKED" ||
      booking.status === "TICKETING_PENDING";
    if (!poll) return;
    const timer = setInterval(() => {
      void load();
    }, 3000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id, booking?.status, booking?.next.awaitingPayment]);

  useEffect(() => {
    if (!booking?.expiresAt || !isActiveFareHold(booking)) return;
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booking?.expiresAt, booking?.status, booking?.next.ticketed, booking?.next.paid]);

  useEffect(() => {
    if (!booking?.expiresAt || !isActiveFareHold(booking)) return;
    const remaining = holdRemainingMs(booking.expiresAt, Date.now());
    if (remaining === null) return;
    if (remaining <= 0) {
      void load();
      return;
    }
    const timer = setTimeout(() => {
      void load();
    }, remaining + 250);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booking?.expiresAt, booking?.status, booking?.next.ticketed, booking?.next.paid]);

  const fillSaved = async (index: number, id: string) => {
    if (!id) return;
    const res = await fetch(`/api/account/passengers/${id}`);
    const data = await res.json();
    if (!res.ok) return;
    const row = data.passenger;
    setPassengers((current) => {
      const next = [...current];
      const existing = next[index];
      if (!existing) return next;
      next[index] = {
        ...existing,
        firstName: row.firstName,
        lastName: row.lastName,
        dateOfBirth: row.dateOfBirth || "",
        nationality: row.nationality || "",
        passportNumber: row.passportNumber || "",
        passportExpiry: row.passportExpiry || "",
      };
      return next;
    });
  };

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
    if (!booking) return;
    const errors = validateTravelerForm(contact, passengers, passportRequiredFor(booking));
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setSaving(true);
    setError("");
    const res = await fetch(`/api/bookings/${params.id}/passengers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contactEmail: contact.email,
        contactPhone: contact.phone,
        passengers: passengers.map((row) => ({
          type: row.type,
          firstName: row.firstName,
          lastName: row.lastName,
          dateOfBirth: row.dateOfBirth,
          nationality: row.nationality,
          passportNumber: row.passportNumber,
          passportExpiry: row.passportExpiry,
        })),
      }),
    });
    const data = await res.json();
    if (!res.ok) setError(data.message || "Unable to save travelers");
    else setBooking(data.booking);
    setSaving(false);
  };

  const applyPromo = async () => {
    setSaving(true);
    setError("");
    const res = await fetch(`/api/bookings/${params.id}/promo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: promoCode }),
    });
    const data = await res.json();
    if (!res.ok) setError(data.message || "Promo code could not be applied.");
    else await load();
    setSaving(false);
  };

  const startPayment = async () => {
    setSaving(true);
    setError("");
    const res = await fetch(`/api/bookings/${params.id}/pay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.message || "Unable to start payment");
      setSaving(false);
      return;
    }
    if (data.redirectUrl) {
      window.location.href = data.redirectUrl;
      return;
    }
    setBooking(data.booking);
    setSaving(false);
  };

  const cancelBooking = async () => {
    setSaving(true);
    setError("");
    const res = await fetch(`/api/bookings/${params.id}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "Customer requested cancellation" }),
    });
    const data = await res.json();
    if (!res.ok) setError(data.message || "Unable to cancel booking");
    else {
      setBooking(data.booking);
      setCancelOpen(false);
    }
    setSaving(false);
  };

  const requestRefund = async () => {
    setSaving(true);
    setError("");
    const res = await fetch(`/api/bookings/${params.id}/refund`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    const data = await res.json();
    if (!res.ok) setError(data.message || "Unable to process refund");
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
      PRICE_CONFIRMED: "Fare confirmed",
      PASSENGER_PENDING: "Traveler details",
      PAYMENT_PENDING: "Ready for payment",
      PAYMENT_PROCESSING: "Waiting for payment",
      PAYMENT_FAILED: "Payment failed",
      PAYMENT_SUCCESS: "Payment received",
      BOOKING_PENDING: "Confirming reservation",
      BOOKED: "Issuing tickets",
      TICKETING_PENDING: "Issuing tickets",
      TICKETED: "Ticketed",
      TICKETING_FAILED: "Ticketing failed",
      BOOKING_FAILED: "Reservation failed",
      BOOKING_UNKNOWN: "Confirming reservation",
      TICKETING_UNKNOWN: "Confirming tickets",
      UNAVAILABLE: "Fare unavailable",
      EXPIRED: "Hold expired",
      CANCELLED: "Cancelled",
      REFUND_PENDING: "Refund in progress",
      REFUNDED: "Refunded",
    };
    return booking ? map[booking.status] ?? booking.status : "";
  }, [booking]);

  const holdExpired = Boolean(
    booking &&
      (booking.status === "EXPIRED" ||
        (isActiveFareHold(booking) && (holdRemainingMs(booking.expiresAt, now) ?? 1) <= 0)),
  );
  const holdBlocksAction = Boolean(holdExpired && booking && !booking.next.paid && !booking.next.searchAgain);

  if (loading) {
    return <CheckoutSkeleton />;
  }

  const passportRequired = booking ? passportRequiredFor(booking) : false;
  const travelerIncomplete = Boolean(
    booking?.next.canSavePassengers &&
      Object.keys(validateTravelerForm(contact, passengers, passportRequired)).length > 0,
  );
  const showStickyCta = Boolean(booking && (booking.next.canSavePassengers || booking.next.canPay) && !holdBlocksAction);

  return (
    <main className={`min-h-screen overflow-x-hidden bg-canvas ${showStickyCta ? "max-lg:pb-28" : ""}`}>
      <div className="mx-auto max-w-[1280px] px-4 py-6 md:px-6 md:py-8">
        {error ? <div className="mb-4"><ErrorBanner message={error} /></div> : null}
        {!booking && !error ? <p className="text-sm font-semibold text-copy-muted">Booking not found.</p> : null}
        {booking ? (
          <div className="space-y-5">
            <BookingProgress booking={booking} step={progressIndex(booking)} />
            <BookingHeader booking={booking} statusLabel={statusLabel} now={now} holdExpired={holdExpired} />

            <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_21rem] lg:gap-6">
              <div className="lg:hidden">
                <FlightSummaryCard booking={booking} />
              </div>

              <div className="flex min-w-0 flex-col gap-5 lg:col-start-1">
                {booking.next.canAcceptPrice && (
                  <section className={CARD}>
                    <h2 className="text-lg font-bold tracking-tight text-navy">The supplier changed this fare</h2>
                    <p className="mt-2 text-sm text-copy-muted">
                      Previous {booking.offer?.previousTotal?.toLocaleString()} {booking.currency}. New total {booking.offer?.fare.totalLabel}.
                    </p>
                    <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                      <button
                        onClick={acceptPrice}
                        disabled={saving}
                        className={`flex-1 rounded-xl bg-navy py-3 text-[11px] font-bold uppercase tracking-widest text-white hover:bg-gold disabled:opacity-50 ${FOCUS}`}
                      >
                        Accept new fare
                      </button>
                      <Link
                        href="/"
                        className={`rounded-xl border border-line px-6 py-3 text-center text-[11px] font-bold uppercase tracking-widest text-copy-muted ${FOCUS}`}
                      >
                        Search again
                      </Link>
                    </div>
                  </section>
                )}

                {booking.next.searchAgain && (
                  <StatusPanel title={booking.status === "EXPIRED" ? "Hold expired" : "Fare unavailable"}>
                    <p>
                      {booking.status === "UNAVAILABLE"
                        ? "This fare or room is no longer available. Search again for live prices."
                        : booking.status === "EXPIRED"
                          ? "The hold expired before payment. Start a new search to lock a fare."
                          : "This fare can no longer be booked. Start a new search."}
                    </p>
                    <Link
                      href={booking.type === "HOTEL" ? "/hotels" : "/"}
                      className={`mt-5 inline-flex rounded-xl bg-navy px-6 py-3 text-[11px] font-bold uppercase tracking-widest text-white hover:bg-gold ${FOCUS}`}
                    >
                      {booking.type === "HOTEL" ? "Search hotels" : "Search flights"}
                    </Link>
                  </StatusPanel>
                )}

                {booking.next.canSavePassengers && (
                  <form id="traveler-form" onSubmit={submitPassengers} className="space-y-5">
                    <ContactSection
                      email={contact.email}
                      phone={contact.phone}
                      prefilled={prefilled}
                      errors={fieldErrors}
                      onChange={(next) => {
                        setContact(next);
                        setFieldErrors((current) => {
                          const nextErrors = { ...current };
                          delete nextErrors.email;
                          delete nextErrors.phone;
                          return nextErrors;
                        });
                      }}
                    />
                    <PassengersSection
                      passengers={passengers}
                      countries={countries}
                      saved={saved}
                      passportRequired={passportRequired}
                      errors={fieldErrors}
                      onChange={(index, patch) => {
                        setPassengers((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
                        setFieldErrors((current) => {
                          const next = { ...current };
                          Object.keys(patch).forEach((key) => {
                            delete next[`${index}.${key}`];
                          });
                          return next;
                        });
                      }}
                      onFillSaved={fillSaved}
                    />
                  </form>
                )}

                {booking.offer && booking.type !== "HOTEL" && (booking.next.canSavePassengers || booking.next.canPay) ? (
                  <>
                    <TravelInformation offer={booking.offer} />
                    <RefundCancellationPanel offer={booking.offer} currency={booking.offer.fare.currency || booking.currency} />
                  </>
                ) : null}

                {booking.next.canPay && (
                  <section className={CARD}>
                    <h2 className="text-lg font-bold tracking-tight text-navy">Payment</h2>
                    <p className="mt-2 text-sm text-copy-muted">
                      Travelers are on file. Total due {booking.offer?.fare.totalLabel}.
                      {booking.status === "PAYMENT_FAILED"
                        ? " The last attempt was declined — you can try again."
                        : " Choose a method and continue to the mock gateway."}
                    </p>
                    <div className="mt-5 flex gap-3">
                      <input
                        className="flex-1 rounded-lg border border-line bg-white px-3 py-2.5 font-semibold uppercase outline-none focus:border-gold focus:ring-2 focus:ring-gold/25"
                        placeholder="Promo code"
                        data-testid="promo-code"
                        value={promoCode}
                        onChange={(e) => setPromoCode(e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={applyPromo}
                        disabled={saving || !promoCode}
                        data-testid="promo-apply"
                        className={`rounded-xl border border-line px-4 text-[10px] font-bold uppercase tracking-widest ${FOCUS}`}
                      >
                        Apply
                      </button>
                    </div>
                    <ul className="mt-5 space-y-2 text-sm font-semibold text-navy">
                      {booking.passengers.map((row) => (
                        <li key={row.id}>
                          {row.type}: {row.firstName} {row.lastName}
                        </li>
                      ))}
                    </ul>
                    <div className="mt-5 grid grid-cols-3 gap-3">
                      {(["CARD", "BKASH", "NAGAD"] as const).map((option) => (
                        <button
                          key={option}
                          type="button"
                          onClick={() => setMethod(option)}
                          className={`rounded-xl border py-3 text-[10px] font-bold uppercase tracking-widest ${
                            method === option ? "border-navy bg-navy text-white" : "border-line text-copy-muted"
                          } ${FOCUS}`}
                        >
                          {option === "CARD" ? "Card" : option === "BKASH" ? "bKash" : "Nagad"}
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={() => router.push("/account/bookings")}
                      className="mt-4 w-full text-[10px] font-bold uppercase tracking-widest text-copy-muted"
                    >
                      View in my bookings
                    </button>
                  </section>
                )}

                {booking.next.awaitingPayment && (
                  <StatusPanel title="Waiting for payment" spinning>
                    <p>Complete the charge on the payment page. This booking updates automatically when the gateway confirms.</p>
                    <button
                      onClick={startPayment}
                      disabled={saving || holdBlocksAction}
                      className={`mt-5 w-full rounded-xl bg-navy py-3 text-[11px] font-bold uppercase tracking-widest text-white hover:bg-gold disabled:opacity-50 ${FOCUS}`}
                    >
                      {saving ? "Opening..." : "Return to payment"}
                    </button>
                  </StatusPanel>
                )}

                {booking.next.paid && (booking.status === "PAYMENT_SUCCESS" || booking.status === "BOOKING_PENDING") && (
                  <StatusPanel title="Confirming with the airline" spinning>
                    <p>Payment received. We are creating your reservation.</p>
                  </StatusPanel>
                )}

                {(booking.status === "BOOKED" || booking.status === "TICKETING_PENDING") && (
                  <StatusPanel title={booking.type === "HOTEL" ? "Issuing hotel vouchers" : "Issuing e-tickets"} spinning>
                    <p>
                      {booking.type === "HOTEL" ? "Confirmation" : "PNR"} {booking.providerRef ?? "pending"}. We are generating
                      PDFs and sending them to {booking.contact?.email || "your email"}.
                    </p>
                  </StatusPanel>
                )}

                {booking.status === "TICKETED" && (
                  <section className={CARD}>
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-gold-dark">
                      {booking.type === "HOTEL" ? "Vouchered" : "Ticketed"}
                    </p>
                    <h2 className="mt-2 text-xl font-bold tracking-tight text-navy">
                      {booking.type === "HOTEL" ? "Your hotel vouchers are ready" : "Your e-tickets are ready"}
                    </h2>
                    <p className="mt-2 text-sm text-copy-muted" data-testid="booking-pnr">
                      {booking.type === "HOTEL" ? "Confirmation" : "PNR"} {booking.providerRef ?? "—"}. Copies were sent to{" "}
                      {booking.contact?.email || "your email"} (check the server console if SMTP is not configured).
                    </p>
                    <ul className="mt-5 space-y-3">
                      {(booking.tickets ?? []).map((ticket) => {
                        const passenger = booking.passengers.find((row) => row.id === ticket.passengerId);
                        return (
                          <li key={ticket.id} className="flex flex-col justify-between gap-3 rounded-xl border border-line p-4 md:flex-row md:items-center">
                            <div>
                              <p className="font-bold tracking-tight text-navy">{ticket.ticketNumber}</p>
                              <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-copy-muted">
                                {passenger ? `${passenger.firstName} ${passenger.lastName}` : "Traveler"}
                              </p>
                            </div>
                            <a
                              href={ticket.pdfUrl}
                              data-testid="ticket-pdf"
                              className={`rounded-xl bg-navy px-5 py-2.5 text-center text-[10px] font-bold uppercase tracking-widest text-white hover:bg-gold ${FOCUS}`}
                            >
                              {booking.type === "HOTEL" ? "Download voucher" : "Download PDF"}
                            </a>
                          </li>
                        );
                      })}
                    </ul>
                    {(booking.invoices ?? []).length > 0 && (
                      <div className="mt-4 flex flex-col justify-between gap-3 rounded-xl border border-line p-4 md:flex-row md:items-center">
                        <div>
                          <p className="font-bold tracking-tight text-navy">{booking.invoices?.[0]?.invoiceNo}</p>
                          <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-copy-muted">
                            Invoice · {booking.invoices?.[0]?.status} · {booking.currency} {booking.invoices?.[0]?.total.toLocaleString()}
                          </p>
                        </div>
                        <a
                          href={booking.invoices?.[0]?.pdfUrl ?? `/api/bookings/${booking.id}/invoice/pdf`}
                          data-testid="invoice-pdf"
                          className={`rounded-xl border border-line px-5 py-2.5 text-center text-[10px] font-bold uppercase tracking-widest text-navy hover:border-gold ${FOCUS}`}
                        >
                          Download invoice
                        </a>
                      </div>
                    )}
                    <button onClick={() => router.push("/account/bookings")} className="mt-5 w-full text-[10px] font-bold uppercase tracking-widest text-copy-muted">
                      View in my bookings
                    </button>
                  </section>
                )}

                {booking.status === "TICKETING_FAILED" && (
                  <section className={CARD}>
                    <h2 className="text-lg font-bold tracking-tight text-navy">Ticketing failed</h2>
                    <p className="mt-2 text-sm text-copy-muted">
                      Payment and PNR {booking.providerRef ?? "—"} are on file, but e-tickets could not be issued. You can retry
                      without paying again.
                    </p>
                    <button
                      onClick={() => {
                        autoIssued.current = false;
                        void issueTickets();
                      }}
                      disabled={saving}
                      className={`mt-5 w-full rounded-xl bg-navy py-3 text-[11px] font-bold uppercase tracking-widest text-white hover:bg-gold disabled:opacity-50 ${FOCUS}`}
                    >
                      {saving ? "Retrying..." : "Retry ticketing"}
                    </button>
                  </section>
                )}

                {(booking.status === "BOOKING_UNKNOWN" || booking.status === "TICKETING_UNKNOWN") && (
                  <section className={CARD}>
                    <h2 className="text-lg font-bold tracking-tight text-navy">
                      {booking.status === "BOOKING_UNKNOWN" ? "Confirming your reservation" : "Confirming your tickets"}
                    </h2>
                    <p className="mt-2 text-sm text-copy-muted">
                      The airline took too long to respond. We have not created a second reservation or ticket. Operations will
                      confirm booking {booking.bookingRef}.
                    </p>
                  </section>
                )}

                {booking.status === "BOOKING_FAILED" && (
                  <section className={CARD}>
                    <h2 className="text-lg font-bold tracking-tight text-navy">Reservation failed</h2>
                    <p className="mt-2 text-sm text-copy-muted">
                      Payment was captured but the airline could not confirm a PNR. You can request a full refund for booking{" "}
                      {booking.bookingRef}.
                    </p>
                    <button
                      onClick={() => void requestRefund()}
                      disabled={saving}
                      className={`mt-5 w-full rounded-xl bg-navy py-3 text-[11px] font-bold uppercase tracking-widest text-white hover:bg-gold disabled:opacity-50 ${FOCUS}`}
                    >
                      {saving ? "Refunding..." : "Request refund"}
                    </button>
                  </section>
                )}

                {(booking.status === "CANCELLED" || booking.status === "REFUND_PENDING" || booking.status === "REFUNDED") && (
                  <section className={CARD}>
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-gold-dark">{statusLabel}</p>
                    <h2 className="mt-2 text-lg font-bold tracking-tight text-navy">
                      {booking.status === "REFUNDED"
                        ? "Refund completed"
                        : booking.status === "REFUND_PENDING"
                          ? "Refund in progress"
                          : "Booking cancelled"}
                    </h2>
                    <p className="mt-2 text-sm text-copy-muted">
                      {booking.status === "REFUNDED"
                        ? "The captured payment has been returned. Tickets on this booking are void."
                        : booking.status === "REFUND_PENDING"
                          ? "The reservation is cancelled. The refund is being settled against the original payment."
                          : "This booking is cancelled. Unpaid holds are released immediately."}
                    </p>
                    {booking.status === "REFUND_PENDING" && (
                      <button
                        onClick={() => void requestRefund()}
                        disabled={saving}
                        className={`mt-5 w-full rounded-xl bg-navy py-3 text-[11px] font-bold uppercase tracking-widest text-white hover:bg-gold disabled:opacity-50 ${FOCUS}`}
                      >
                        {saving ? "Checking..." : "Retry refund"}
                      </button>
                    )}
                    <button onClick={() => router.push("/account/bookings")} className="mt-4 w-full text-[10px] font-bold uppercase tracking-widest text-copy-muted">
                      View in my bookings
                    </button>
                  </section>
                )}

                {(booking.history?.length || booking.payments?.length || !booking.next.paid) ? (
                  <div className="grid gap-5 md:grid-cols-2">
                    <StatusTimeline history={booking.history ?? []} currentStatus={booking.status} />
                    <PaymentsRefundsPanel booking={booking} />
                  </div>
                ) : null}

                {booking.next.canCancel && booking.status !== "BOOKING_FAILED" ? (
                  <CancelBookingBlock paid={booking.next.paid} saving={saving} onAsk={() => setCancelOpen(true)} />
                ) : null}
              </div>

              <aside className="min-w-0 lg:sticky lg:top-20 lg:col-start-2 lg:row-span-2 lg:self-start">
                <div className="hidden lg:block">
                  <FlightSummaryCard booking={booking} />
                </div>
                <div className="mt-5 lg:mt-5">
                  <BookingSummaryCard booking={booking} now={now} holdExpired={holdExpired}>
                    {booking.next.canSavePassengers ? (
                      <PrimaryCta
                        type="submit"
                        form="traveler-form"
                        testId="continue-payment"
                        disabled={saving || holdBlocksAction || travelerIncomplete}
                        hint="Securely continue to payment"
                      >
                        {saving ? "Saving..." : "Continue to payment →"}
                      </PrimaryCta>
                    ) : null}
                    {booking.next.canPay ? (
                      <PrimaryCta
                        testId="pay-now"
                        disabled={saving || holdBlocksAction}
                        onClick={startPayment}
                        hint="Securely continue to payment"
                      >
                        {saving ? "Redirecting..." : booking.status === "PAYMENT_FAILED" ? "Retry payment" : "Pay now →"}
                      </PrimaryCta>
                    ) : null}
                  </BookingSummaryCard>
                </div>
              </aside>
            </div>

            {showStickyCta ? (
              <StickyMobileCta>
                {booking.next.canSavePassengers ? (
                  <PrimaryCta
                    type="submit"
                    form="traveler-form"
                    disabled={saving || holdBlocksAction || travelerIncomplete}
                    hint="Securely continue to payment"
                    className=""
                  >
                    {saving ? "Saving..." : "Continue to payment →"}
                  </PrimaryCta>
                ) : (
                  <PrimaryCta
                    disabled={saving || holdBlocksAction}
                    onClick={startPayment}
                    hint="Securely continue to payment"
                    className=""
                  >
                    {saving ? "Redirecting..." : booking.status === "PAYMENT_FAILED" ? "Retry payment" : "Pay now →"}
                  </PrimaryCta>
                )}
              </StickyMobileCta>
            ) : null}

            <CancelConfirmDialog
              open={cancelOpen}
              paid={booking.next.paid}
              saving={saving}
              onClose={() => setCancelOpen(false)}
              onConfirm={() => void cancelBooking()}
            />
          </div>
        ) : null}
      </div>
    </main>
  );
}
