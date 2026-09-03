"use client";

import { Badge, Modal, Skeleton } from "@onetrips/ui";
import {
  Briefcase,
  Clock3,
  Luggage,
  ShieldCheck,
  Ticket,
} from "lucide-react";
import type { ReactNode } from "react";
import {
  CARD,
  FIELD,
  FIELD_ERROR,
  FOCUS,
  LABEL,
  bookingRoute,
  bookingTravelDate,
  confirmationComplete,
  fareBreakdownRows,
  formatCountdown,
  formatTravelDate,
  holdRemainingMs,
  isActiveFareHold,
  itineraryRoute,
  money,
  offerRefund,
  refundDisplay,
  passengerHeading,
  passengerSummary,
  timelineTone,
  type Booking,
  type BookingOffer,
  type PassengerForm,
  type ProgressStep,
} from "./checkoutModel";

const STEPS = [
  { id: 0, label: "Flight selected" },
  { id: 1, label: "Traveler details" },
  { id: 2, label: "Payment" },
  { id: 3, label: "Confirmation" },
] as const;

export function CheckoutSkeleton() {
  return (
    <main className="min-h-screen bg-canvas" aria-busy="true" aria-label="Loading booking">
      <div className="mx-auto max-w-[1280px] px-4 py-6 md:px-6 md:py-8">
        <Skeleton className="h-10 w-full max-w-xl" />
        <Skeleton className="mt-5 h-28 w-full" />
        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_21rem]">
          <div className="space-y-4">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-72 w-full" />
          </div>
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    </main>
  );
}

export function BookingProgress({
  booking,
  step,
}: {
  booking: Booking;
  step: ProgressStep;
}) {
  const labels =
    booking.type === "HOTEL"
      ? ["Stay selected", "Guest details", "Payment", "Confirmation"]
      : STEPS.map((item) => item.label);

  return (
    <nav aria-label="Booking progress" className="rounded-[14px] border border-line bg-white px-4 py-3 shadow-[0_2px_10px_rgba(16,23,42,0.03)]">
      <ol className="grid grid-cols-2 gap-x-4 gap-y-2 md:grid-cols-4 md:gap-3">
        {labels.map((label, index) => {
          const finished = confirmationComplete(booking);
          const done = finished ? index <= step : index < step;
          const active = !finished && index === step;
          return (
            <li key={label} className="min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className={`flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                    done
                      ? "bg-emerald-600 text-white"
                      : active
                        ? "bg-gold text-navy"
                        : "bg-field text-copy-muted"
                  }`}
                  aria-hidden
                >
                  {done ? "✓" : index + 1}
                </span>
                <span
                  className={`truncate text-[11px] font-semibold ${
                    active ? "text-navy" : done ? "text-emerald-800" : "text-copy-muted"
                  }`}
                >
                  {label}
                </span>
              </div>
              <div className="mt-2 h-0.5 overflow-hidden rounded-full bg-line">
                <div
                  className={`h-full ${done ? "w-full bg-emerald-500" : active ? "w-2/3 bg-gold" : "w-0"}`}
                />
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function HoldBadge({
  expiresAt,
  now,
  expired,
}: {
  expiresAt: string | null;
  now: number;
  expired: boolean;
}) {
  const remaining = holdRemainingMs(expiresAt, now);
  if (expired || (remaining !== null && remaining <= 0)) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-red-700">
        Hold expired
      </span>
    );
  }
  if (remaining === null) return null;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-[#d4af37]/35 bg-gold-soft px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-gold-dark">
      Fare held
      <span className="font-semibold normal-case tracking-normal text-navy">
        Hold expires in {formatCountdown(remaining)}
      </span>
    </span>
  );
}

export function BookingHeader({
  booking,
  statusLabel,
  now,
  holdExpired,
}: {
  booking: Booking;
  statusLabel: string;
  now: number;
  holdExpired: boolean;
}) {
  const route = bookingRoute(booking);
  const date = bookingTravelDate(booking);
  const meta = [
    date,
    passengerSummary(booking.request),
    booking.offer?.cabinLabel,
    booking.offer?.brandedFare,
  ]
    .filter(Boolean)
    .join(" · ");
  const title =
    booking.next.canSavePassengers || booking.status === "PASSENGER_PENDING"
      ? booking.type === "HOTEL"
        ? "Guest details"
        : "Traveler details"
      : statusLabel;

  return (
    <header className={CARD}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[1.65rem] font-bold tracking-tight text-navy md:text-[1.85rem]" data-testid="booking-status">
            {title}
          </h1>
          <p className="mt-2 text-sm font-semibold text-copy-muted">
            Booking reference:{" "}
            <span data-testid="booking-ref" className="text-navy">
              Booking {booking.bookingRef}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isActiveFareHold(booking) ? (
            <HoldBadge expiresAt={booking.expiresAt} now={now} expired={holdExpired} />
          ) : null}
          {booking.offer ? (
            <Badge tone={booking.offer.refundable ? "success" : "neutral"}>
              {booking.offer.refundable ? "Refundable" : "Non-refundable"}
            </Badge>
          ) : null}
        </div>
      </div>
      <p className="mt-4 text-lg font-bold tracking-tight text-navy">{booking.hotel ? booking.hotel.name : route}</p>
      {meta ? <p className="mt-1 text-sm font-medium text-copy-muted">{meta}</p> : null}
      {booking.next.canSavePassengers || booking.status === "PASSENGER_PENDING" ? (
        <p className="mt-4 text-sm text-copy">Your fare is held. Complete traveler information to continue.</p>
      ) : null}
    </header>
  );
}

export function FlightSummaryCard({ booking }: { booking: Booking }) {
  if (booking.type === "HOTEL" && booking.hotel) {
    const hotel = booking.hotel;
    return (
      <section className={CARD}>
        <p className={LABEL}>Stay summary</p>
        <h2 className="mt-2 text-base font-bold text-navy">{hotel.name}</h2>
        <p className="mt-1 text-sm font-medium text-copy-muted">
          {hotel.room.name} · {hotel.board} · {hotel.room.bedType}
        </p>
        <p className="mt-2 text-sm text-copy">
          {hotel.checkIn} to {hotel.checkOut} · {hotel.nights} night{hotel.nights > 1 ? "s" : ""}
        </p>
        <p className="mt-1 text-sm text-copy-muted">
          {hotel.address}, {hotel.city}
        </p>
      </section>
    );
  }

  const itineraries = booking.offer?.itineraries ?? [];
  if (itineraries.length === 0) return null;

  return (
    <section className={CARD}>
      <p className={LABEL}>Flight summary</p>
      <div className="mt-4 space-y-5">
        {itineraries.map((itinerary, index) => (
          <div key={`${itineraryRoute(itinerary)}-${index}`}>
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-gold-dark">
                  {index === 0 ? "Outbound" : "Return"}
                </p>
                <p className="mt-1 text-sm font-bold text-navy">{itineraryRoute(itinerary)}</p>
              </div>
              <p className="text-xs font-semibold text-copy-muted">
                {itinerary.durationLabel} · {itinerary.stopsLabel}
              </p>
            </div>
            <ul className="mt-3 space-y-2.5">
              {itinerary.segments.map((leg) => (
                <li key={`${leg.flightNumber}-${leg.departureTime}`} className="min-w-0">
                  <p className="text-sm font-semibold text-navy">
                    {leg.airlineName}{" "}
                    <span className="font-bold tabular-nums">{leg.flightNumber}</span>
                  </p>
                  <p className="text-xs font-medium text-copy-muted">
                    {leg.departureTime} {leg.origin} → {leg.arrivalTime} {leg.destination}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

export function BookingSummaryCard({
  booking,
  now,
  holdExpired,
  children,
}: {
  booking: Booking;
  now: number;
  holdExpired: boolean;
  children?: ReactNode;
}) {
  const fare = booking.offer?.fare;
  const currency = fare?.currency || booking.currency;
  const rows = fare ? fareBreakdownRows(fare) : [];
  const refund =
    booking.offer && booking.type !== "HOTEL" ? refundDisplay(offerRefund(booking.offer, currency)) : null;
  const remaining = holdRemainingMs(booking.expiresAt, now);
  const held = isActiveFareHold(booking) && remaining !== null && remaining > 0 && !holdExpired;

  return (
    <section className="overflow-hidden rounded-[14px] border border-line bg-white shadow-[0_8px_24px_rgba(16,23,42,0.05)]">
      <div className="h-1 bg-gold" aria-hidden />
      <div className="p-5 md:p-6">
        <p className={LABEL}>Booking summary</p>
        <dl className="mt-4 space-y-2 text-sm">
          <SummaryRow label="Route" value={bookingRoute(booking)} />
          <SummaryRow label="Passenger" value={passengerSummary(booking.request)} />
          <SummaryRow
            label="Cabin"
            value={[booking.offer?.cabinLabel, booking.offer?.brandedFare].filter(Boolean).join(" · ") || "—"}
          />
        </dl>
        {fare ? (
          <div className="mt-5" data-testid="price-breakdown">
            <p className={LABEL}>Fare breakdown</p>
            <ul className="mt-3 space-y-2">
              {rows.map((row) => (
                <li key={row.label} className="flex items-baseline justify-between gap-4 text-sm">
                  <span className="font-medium text-copy-muted">{row.label}</span>
                  <span className="tabular-nums font-semibold text-navy">{money(currency, row.amount)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 rounded-xl bg-field px-4 py-3.5">
              <div className="flex items-end justify-between gap-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-copy-muted">Total</p>
                <p className="text-[1.65rem] font-bold leading-none tabular-nums tracking-tight text-navy">
                  {fare.totalLabel}
                </p>
              </div>
            </div>
            {refund ? (
              <ul className="mt-4 space-y-2 border-t border-line pt-4">
                <li className="flex items-baseline justify-between gap-4 text-sm">
                  <span className="font-medium text-copy-muted">Refundable amount</span>
                  <span className={`text-right font-semibold tabular-nums ${refund.pending ? "text-copy-muted" : "text-navy"}`}>
                    {refund.amountText}
                  </span>
                </li>
                <li className="flex items-baseline justify-between gap-4 text-sm">
                  <span className="font-medium text-copy-muted">{refund.feeLabel}</span>
                  <span className={`text-right font-semibold tabular-nums ${refund.pending ? "text-copy-muted" : "text-navy"}`}>
                    {refund.feeText}
                  </span>
                </li>
              </ul>
            ) : null}
          </div>
        ) : null}
        <div className="mt-5 flex items-center gap-2 text-xs font-semibold text-copy-muted">
          <ShieldCheck className="size-3.5 text-gold-dark" aria-hidden />
          Secure booking
        </div>
        {held ? (
          <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-navy">
            <Clock3 className="size-3.5 text-gold-dark" aria-hidden />
            Fare held · {formatCountdown(remaining)} remaining
          </p>
        ) : null}
        {children}
      </div>
    </section>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-copy-muted">{label}</dt>
      <dd className="text-right font-semibold text-navy">{value}</dd>
    </div>
  );
}

export function TravelInformation({ offer }: { offer: BookingOffer }) {
  return (
    <section className={CARD}>
      <p className={LABEL}>Travel information</p>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        <InfoTile icon={<Briefcase className="size-4" />} label="Cabin baggage" value={offer.baggage.cabin || "—"} />
        <InfoTile icon={<Luggage className="size-4" />} label="Checked baggage" value={offer.baggage.checked || "—"} />
        <InfoTile icon={<Ticket className="size-4" />} label="Fare type" value={offer.brandedFare || "—"} />
        <InfoTile
          icon={<ShieldCheck className="size-4" />}
          label="Fare conditions"
          value={offer.refundable ? "Refundable" : "Non-refundable"}
        />
      </dl>
    </section>
  );
}

function InfoTile({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-field px-4 py-3">
      <dt className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-copy-muted">
        <span className="text-navy">{icon}</span>
        {label}
      </dt>
      <dd className="mt-1.5 text-sm font-semibold text-navy">{value}</dd>
    </div>
  );
}

export function RefundCancellationPanel({
  offer,
  currency,
}: {
  offer: BookingOffer;
  currency: string;
}) {
  const refund = refundDisplay(offerRefund(offer, currency));
  return (
    <section className={CARD} data-testid="refund-summary">
      <p className={LABEL}>Refund & cancellation</p>
      <dl className="mt-4 space-y-3">
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-sm font-medium text-copy-muted">Refundable amount</dt>
          <dd className={`text-right text-sm font-bold tabular-nums ${refund.pending ? "text-copy-muted" : "text-navy"}`}>
            {refund.amountText}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-sm font-medium text-copy-muted">{refund.feeLabel}</dt>
          <dd className={`text-right text-sm font-bold tabular-nums ${refund.pending ? "text-copy-muted" : "text-navy"}`}>
            {refund.feeText}
          </dd>
        </div>
      </dl>
      <p className="mt-4 text-xs leading-5 text-copy-muted">
        Refund amount is subject to the fare rules and applicable cancellation conditions.
      </p>
    </section>
  );
}

export function Field({
  label,
  error,
  hint,
  required,
  children,
  htmlFor,
}: {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
  htmlFor: string;
}) {
  return (
    <div className="min-w-0">
      <label htmlFor={htmlFor} className="mb-1.5 block text-[12px] font-semibold text-navy">
        {label}
        {required ? <span className="text-red-600"> *</span> : null}
      </label>
      {children}
      {hint && !error ? <p className="mt-1.5 text-xs text-copy-muted">{hint}</p> : null}
      {error ? (
        <p id={`${htmlFor}-error`} role="alert" className="mt-1.5 text-xs font-medium text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function ContactSection({
  email,
  phone,
  prefilled,
  errors,
  onChange,
}: {
  email: string;
  phone: string;
  prefilled: { email: boolean; phone: boolean };
  errors: Record<string, string>;
  onChange: (next: { email: string; phone: string }) => void;
}) {
  return (
    <section className={CARD}>
      <p className={LABEL}>Contact information</p>
      <p className="mt-2 text-sm text-copy-muted">
        We&apos;ll use these details for booking updates and ticket delivery.
      </p>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <Field
          htmlFor="contact-email"
          label="Email address"
          error={errors.email}
          hint={prefilled.email ? "Prefilled from your account. You can update it if needed." : undefined}
        >
          <input
            id="contact-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => onChange({ email: event.target.value, phone })}
            className={`${FIELD} ${errors.email ? FIELD_ERROR : ""}`}
            aria-invalid={errors.email ? true : undefined}
          />
        </Field>
        <Field
          htmlFor="contact-phone"
          label="Mobile number"
          error={errors.phone}
          hint={prefilled.phone ? "Prefilled from your account. You can update it if needed." : undefined}
        >
          <input
            id="contact-phone"
            type="tel"
            autoComplete="tel"
            value={phone}
            onChange={(event) => onChange({ email, phone: event.target.value })}
            className={`${FIELD} ${errors.phone ? FIELD_ERROR : ""}`}
            aria-invalid={errors.phone ? true : undefined}
          />
        </Field>
      </div>
    </section>
  );
}

export function PassengerCard({
  passenger,
  index,
  heading,
  countries,
  saved,
  passportRequired,
  errors,
  onChange,
  onFillSaved,
}: {
  passenger: PassengerForm;
  index: number;
  heading: string;
  countries: Array<{ code: string; name: string }>;
  saved: Array<{ id: string; firstName: string; lastName: string; type: string }>;
  passportRequired: boolean;
  errors: Record<string, string>;
  onChange: (patch: Partial<PassengerForm>) => void;
  onFillSaved: (id: string) => void;
}) {
  const matches = saved.filter((row) => row.type === passenger.type);
  return (
    <section className={CARD}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-gold-dark">{heading}</p>
          <p className="mt-1 text-sm font-medium text-copy-muted">Passenger details</p>
        </div>
        {matches.length > 0 ? (
          <select
            className={`${FIELD} w-auto min-w-[12rem]`}
            defaultValue=""
            aria-label={`Use a saved traveler for ${heading}`}
            onChange={(event) => onFillSaved(event.target.value)}
          >
            <option value="">Use saved traveler</option>
            {matches.map((row) => (
              <option key={row.id} value={row.id}>
                {row.firstName} {row.lastName}
              </option>
            ))}
          </select>
        ) : null}
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-[7.5rem_minmax(0,1fr)_minmax(0,1fr)]">
        <Field htmlFor={`passenger-title-${index}`} label="Title">
          <select
            id={`passenger-title-${index}`}
            value={passenger.title}
            onChange={(event) => onChange({ title: event.target.value })}
            className={FIELD}
            aria-label={`Title for ${heading}`}
          >
            <option value="">Select</option>
            <option value="MR">Mr</option>
            <option value="MRS">Mrs</option>
            <option value="MS">Ms</option>
            <option value="MX">Mx</option>
          </select>
        </Field>
        <Field htmlFor={`passenger-first-${index}`} label="First name" required error={errors[`${index}.firstName`]}>
          <input
            id={`passenger-first-${index}`}
            data-testid={`passenger-first-${index}`}
            required
            autoComplete="given-name"
            value={passenger.firstName}
            onChange={(event) => onChange({ firstName: event.target.value })}
            className={`${FIELD} ${errors[`${index}.firstName`] ? FIELD_ERROR : ""}`}
          />
        </Field>
        <Field htmlFor={`passenger-last-${index}`} label="Last name" required error={errors[`${index}.lastName`]}>
          <input
            id={`passenger-last-${index}`}
            data-testid={`passenger-last-${index}`}
            required
            autoComplete="family-name"
            value={passenger.lastName}
            onChange={(event) => onChange({ lastName: event.target.value })}
            className={`${FIELD} ${errors[`${index}.lastName`] ? FIELD_ERROR : ""}`}
          />
        </Field>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Field
          htmlFor={`passenger-dob-${index}`}
          label="Date of birth"
          required
          hint={passenger.dateOfBirth ? formatTravelDate(passenger.dateOfBirth) : undefined}
          error={errors[`${index}.dateOfBirth`]}
        >
          <input
            id={`passenger-dob-${index}`}
            data-testid={`passenger-dob-${index}`}
            required
            type="date"
            lang="en-GB"
            value={passenger.dateOfBirth}
            onChange={(event) => onChange({ dateOfBirth: event.target.value })}
            className={`${FIELD} ${errors[`${index}.dateOfBirth`] ? FIELD_ERROR : ""}`}
          />
        </Field>
        <Field htmlFor={`passenger-nationality-${index}`} label="Nationality" required error={errors[`${index}.nationality`]}>
          <select
            id={`passenger-nationality-${index}`}
            data-testid={`passenger-nationality-${index}`}
            required
            value={passenger.nationality}
            onChange={(event) => onChange({ nationality: event.target.value })}
            className={`${FIELD} ${errors[`${index}.nationality`] ? FIELD_ERROR : ""}`}
          >
            <option value="">Select nationality</option>
            {countries.map((country) => (
              <option key={country.code} value={country.code}>
                {country.name}
              </option>
            ))}
          </select>
        </Field>
        <Field
          htmlFor={`passenger-passport-${index}`}
          label="Passport number"
          required={passportRequired}
          error={errors[`${index}.passportNumber`]}
        >
          <input
            id={`passenger-passport-${index}`}
            data-testid={`passenger-passport-${index}`}
            required={passportRequired}
            value={passenger.passportNumber}
            onChange={(event) => onChange({ passportNumber: event.target.value })}
            className={`${FIELD} ${errors[`${index}.passportNumber`] ? FIELD_ERROR : ""}`}
          />
        </Field>
        <Field
          htmlFor={`passenger-passport-expiry-${index}`}
          label="Passport expiry date"
          required={passportRequired}
          hint={passenger.passportExpiry ? formatTravelDate(passenger.passportExpiry) : undefined}
          error={errors[`${index}.passportExpiry`]}
        >
          <input
            id={`passenger-passport-expiry-${index}`}
            data-testid={`passenger-passport-expiry-${index}`}
            required={passportRequired}
            type="date"
            lang="en-GB"
            value={passenger.passportExpiry}
            onChange={(event) => onChange({ passportExpiry: event.target.value })}
            className={`${FIELD} ${errors[`${index}.passportExpiry`] ? FIELD_ERROR : ""}`}
          />
        </Field>
      </div>
    </section>
  );
}

export function PassengersSection({
  passengers,
  countries,
  saved,
  passportRequired,
  errors,
  onChange,
  onFillSaved,
}: {
  passengers: PassengerForm[];
  countries: Array<{ code: string; name: string }>;
  saved: Array<{ id: string; firstName: string; lastName: string; type: string }>;
  passportRequired: boolean;
  errors: Record<string, string>;
  onChange: (index: number, patch: Partial<PassengerForm>) => void;
  onFillSaved: (index: number, id: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <p className={LABEL}>Passengers</p>
        <p className="mt-1 text-sm text-copy-muted">Enter names exactly as they appear on the travel document.</p>
      </div>
      {passengers.map((passenger, index) => (
        <PassengerCard
          key={`${passenger.type}-${index}`}
          passenger={passenger}
          index={index}
          heading={passengerHeading(passengers, index)}
          countries={countries}
          saved={saved}
          passportRequired={passportRequired}
          errors={errors}
          onChange={(patch) => onChange(index, patch)}
          onFillSaved={(id) => onFillSaved(index, id)}
        />
      ))}
    </div>
  );
}

export function PrimaryCta({
  form,
  testId,
  disabled,
  onClick,
  type = "button",
  children,
  hint,
  className = "mt-5",
}: {
  form?: string;
  testId?: string;
  disabled?: boolean;
  onClick?: () => void;
  type?: "button" | "submit";
  children: ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <button
        type={type}
        form={form}
        data-testid={testId}
        disabled={disabled}
        onClick={onClick}
        className={`flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-navy text-[11px] font-bold uppercase tracking-widest text-white transition-colors hover:bg-gold disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS}`}
      >
        {children}
      </button>
      {hint ? <p className="mt-2 text-center text-xs font-medium text-copy-muted">{hint}</p> : null}
    </div>
  );
}

export function StickyMobileCta({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-16 z-40 border-t border-line bg-white/95 px-4 py-3 shadow-[0_-8px_24px_rgba(16,23,42,0.08)] backdrop-blur-md lg:hidden">
      {children}
    </div>
  );
}

export function CancelBookingBlock({
  paid,
  saving,
  onAsk,
}: {
  paid?: boolean;
  saving: boolean;
  onAsk: () => void;
}) {
  return (
    <section className="rounded-[14px] border border-line bg-white px-5 py-4">
      <p className={LABEL}>{paid ? "Cancel booking" : "Cancel held booking"}</p>
      <p className="mt-2 text-sm font-semibold text-navy">
        {paid ? "Cancel this booking" : "This booking has not been paid yet."}
      </p>
      <p className="mt-1 text-xs leading-5 text-copy-muted">
        {paid
          ? "Cancelling voids tickets and refunds the captured payment through the payment gateway."
          : "Cancelling will release the held fare and return you to flight search."}
      </p>
      <button
        type="button"
        disabled={saving}
        onClick={onAsk}
        className={`mt-3 rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-50 disabled:opacity-50 ${FOCUS}`}
      >
        {saving ? "Cancelling..." : "Cancel booking"}
      </button>
    </section>
  );
}

export function StatusTimeline({
  history,
  currentStatus,
}: {
  history: Booking["history"];
  currentStatus: string;
}) {
  return (
    <section className={CARD} data-testid="booking-timeline">
      <p className="mb-4 text-[10px] font-bold uppercase tracking-widest text-copy-muted">Status timeline</p>
      <ol className="space-y-3">
        {(history ?? []).map((row, index) => {
          const tone = timelineTone(row.toStatus, currentStatus);
          const current = tone === "current";
          const failed = tone === "failed";
          return (
            <li key={`${row.toStatus}-${index}`} className="flex gap-3 text-sm">
              <span
                className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                  failed
                    ? "bg-red-600 text-white"
                    : current
                      ? "bg-gold text-navy"
                      : "bg-emerald-600 text-white"
                }`}
                aria-hidden
              >
                {failed ? "!" : current ? "●" : "✓"}
              </span>
              <div className="min-w-0">
                <p
                  className={`font-bold tracking-tight ${
                    failed ? "text-red-700" : current ? "text-gold-dark" : "text-navy"
                  }`}
                >
                  {row.toStatus.replaceAll("_", " ")}
                </p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-copy-muted">
                  {new Date(row.at).toLocaleString()} {row.reason ? `· ${row.reason}` : ""}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export function PaymentsRefundsPanel({ booking }: { booking: Booking }) {
  const fare = booking.offer?.fare;
  const currency = fare?.currency || booking.currency;
  const refund = booking.offer && booking.type !== "HOTEL" ? refundDisplay(offerRefund(booking.offer, currency)) : null;
  const payments = booking.payments ?? [];
  const captured = payments.filter((row) => row.status === "SUCCESS" || row.status === "CAPTURED");
  const rows = captured.length > 0 ? captured : payments;
  const unpaid = !booking.next.paid && rows.length === 0;

  return (
    <section className={CARD} data-testid="booking-payments">
      <p className="mb-4 text-[10px] font-bold uppercase tracking-widest text-copy-muted">Payments & refunds</p>
      {unpaid ? (
        <dl className="space-y-3 text-sm">
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-copy-muted">Payment status</dt>
            <dd className="font-bold uppercase tracking-wide text-navy">Unpaid</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-copy-muted">Amount due</dt>
            <dd className="font-bold tabular-nums text-navy">{fare?.totalLabel ?? money(currency, booking.totalAmount)}</dd>
          </div>
          {refund ? (
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-copy-muted">Refund status</dt>
              <dd className="text-right font-semibold text-navy">
                {booking.offer?.refundable
                  ? `Refundable — ${refund.pending ? "confirming fare rules…" : refund.amountText}`
                  : "Non-refundable"}
              </dd>
            </div>
          ) : null}
          <p className="text-xs leading-5 text-copy-muted">No payment has been received for this booking yet.</p>
        </dl>
      ) : rows.length > 0 ? (
        <ul className="space-y-3 text-sm">
          {rows.map((row) => (
            <li key={row.id}>
              <p className="font-bold uppercase text-navy">
                {row.status} · {row.method || "Gateway"}
              </p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-copy-muted">
                {row.currency} {row.amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              {row.providerRef ? (
                <p className="text-[10px] font-bold uppercase tracking-widest text-copy-muted">Ref {row.providerRef}</p>
              ) : null}
              {row.createdAt ? (
                <p className="text-[10px] font-bold uppercase tracking-widest text-copy-muted">
                  {new Date(row.createdAt).toLocaleString()}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <dl className="space-y-3 text-sm">
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-copy-muted">Payment status</dt>
            <dd className="font-bold uppercase tracking-wide text-navy">{booking.status.replaceAll("_", " ")}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-copy-muted">Amount</dt>
            <dd className="font-bold tabular-nums text-navy">{fare?.totalLabel ?? money(currency, booking.totalAmount)}</dd>
          </div>
        </dl>
      )}
      {booking.status === "REFUND_PENDING" || booking.status === "REFUNDED" ? (
        <p className="mt-4 text-sm font-medium text-copy" data-testid="refund-tracker">
          {booking.status === "REFUNDED"
            ? "Refund settled against the original payment method."
            : "Refund is in progress. We will email you when the gateway confirms."}
        </p>
      ) : null}
    </section>
  );
}

export function CancelConfirmDialog({
  open,
  paid,
  saving,
  onClose,
  onConfirm,
}: {
  open: boolean;
  paid?: boolean;
  saving: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal open={open} title="Cancel this booking?" onClose={onClose}>
      <p className="text-sm leading-6 text-copy">
        {paid
          ? "Cancelling voids tickets and refunds the captured payment through the payment gateway."
          : "This unpaid hold will be released. You can search again afterwards."}
      </p>
      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onClose}
          className={`rounded-xl border border-line px-4 py-2.5 text-[11px] font-bold uppercase tracking-widest text-navy ${FOCUS}`}
        >
          Keep booking
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={onConfirm}
          className={`rounded-xl bg-red-700 px-4 py-2.5 text-[11px] font-bold uppercase tracking-widest text-white hover:bg-red-800 disabled:opacity-50 ${FOCUS}`}
        >
          {saving ? "Cancelling..." : "Cancel booking"}
        </button>
      </div>
    </Modal>
  );
}

export function StatusPanel({
  title,
  children,
  spinning,
}: {
  title: string;
  children: ReactNode;
  spinning?: boolean;
}) {
  return (
    <section className={`${CARD} text-center`}>
      {spinning ? (
        <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-[#d4af37]/20 border-t-[#d4af37]" />
      ) : null}
      <h2 className="text-xl font-bold tracking-tight text-navy">{title}</h2>
      <div className="mt-3 text-sm leading-6 text-copy-muted">{children}</div>
    </section>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div role="alert" className="rounded-[14px] border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
      {message}
    </div>
  );
}

