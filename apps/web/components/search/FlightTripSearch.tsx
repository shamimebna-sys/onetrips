"use client";

import { ArrowRightLeft, CalendarDays, MapPin, PlaneTakeoff } from "lucide-react";
import { AirportPicker } from "@/app/flights/AirportPicker";
import { MultiCitySegments } from "./MultiCitySegments";
import type { MultiCitySegment } from "./flightSearchQuery";
import {
  CabinOptions,
  PassengerOptions,
  SearchButton,
  SearchField,
  SearchFieldsRow,
  SearchSelect,
  SearchSecondaryRow,
  SearchSubmitRow,
  type SearchTripType,
} from "./SearchChrome";

/** Homepage one-way / round-trip / multi-city field layout. */
export function FlightTripSearch({
  tripType,
  origin,
  destination,
  departureDate,
  returnDate,
  adults,
  cabin,
  segments,
  onOrigin,
  onDestination,
  onDeparture,
  onReturn,
  onAdults,
  onCabin,
  onSegments,
  onSwap,
  loading,
  searchTestId,
}: {
  tripType: SearchTripType;
  origin: string;
  destination: string;
  departureDate: string;
  returnDate: string;
  adults: string;
  cabin: string;
  segments: MultiCitySegment[];
  onOrigin: (value: string) => void;
  onDestination: (value: string) => void;
  onDeparture: (value: string) => void;
  onReturn: (value: string) => void;
  onAdults: (value: string) => void;
  onCabin: (value: string) => void;
  onSegments: (segments: MultiCitySegment[]) => void;
  onSwap?: () => void;
  loading?: boolean;
  searchTestId?: string;
}) {
  return (
    <>
      {tripType !== "multi-city" ? (
        <SearchFieldsRow>
          <div className="relative min-w-0">
            <AirportPicker
              label="Origin"
              value={origin}
              onChange={onOrigin}
              icon={<PlaneTakeoff className="text-[#996515]" />}
              testId="search-origin"
            />
            {onSwap ? (
              <button
                type="button"
                aria-label="Swap origin and destination"
                onClick={onSwap}
                className="absolute -right-4 top-[3.15rem] z-10 flex h-8 w-8 items-center justify-center rounded-full border border-slate-100 bg-white text-[#996515] shadow-sm hover:bg-[#d4af37] hover:text-white"
              >
                <ArrowRightLeft size={14} />
              </button>
            ) : null}
          </div>
          <AirportPicker
            label="Destination"
            value={destination}
            onChange={onDestination}
            icon={<MapPin className="text-[#996515]" />}
            testId="search-destination"
          />
          <SearchField
            label="Departure"
            type="date"
            value={departureDate}
            onChange={onDeparture}
            icon={<CalendarDays className="text-[#996515]" />}
          />
          {tripType === "round-trip" ? (
            <SearchField
              label="Return"
              type="date"
              value={returnDate}
              onChange={onReturn}
              icon={<CalendarDays className="text-[#d4af37]" />}
            />
          ) : (
            <SearchButton loading={loading} data-testid={searchTestId} />
          )}
        </SearchFieldsRow>
      ) : (
        <MultiCitySegments segments={segments} onChange={onSegments} />
      )}
      <SearchSecondaryRow>
        <SearchSelect label="Passengers" value={adults} onChange={onAdults}>
          <PassengerOptions />
        </SearchSelect>
        <SearchSelect label="Cabin" value={cabin} onChange={onCabin}>
          <CabinOptions />
        </SearchSelect>
      </SearchSecondaryRow>
      {(tripType === "round-trip" || tripType === "multi-city") && (
        <SearchSubmitRow>
          <SearchButton variant="block" loading={loading} data-testid={searchTestId}>
            Search Flights
          </SearchButton>
        </SearchSubmitRow>
      )}
    </>
  );
}
