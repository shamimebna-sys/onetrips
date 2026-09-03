"use client";

import { CalendarDays, MapPin } from "lucide-react";
import {
  SearchButton,
  SearchField,
  SearchFieldsRow,
  SearchSelect,
  SearchSecondaryRow,
} from "./SearchChrome";

/** Homepage hotel field layout — destination, dates, rooms/guests, search. */
export function HotelSearchFields({
  destination,
  checkIn,
  checkOut,
  rooms,
  adults,
  childrenCount,
  onDestination,
  onCheckIn,
  onCheckOut,
  onRooms,
  onAdults,
  onChildren,
  loading,
  searchTestId,
}: {
  destination: string;
  checkIn: string;
  checkOut: string;
  rooms: string;
  adults: string;
  childrenCount: string;
  onDestination: (value: string) => void;
  onCheckIn: (value: string) => void;
  onCheckOut: (value: string) => void;
  onRooms: (value: string) => void;
  onAdults: (value: string) => void;
  onChildren: (value: string) => void;
  loading?: boolean;
  searchTestId?: string;
}) {
  return (
    <>
      <SearchFieldsRow>
        <SearchField
          label="Destination"
          placeholder="DAC or Dhaka"
          uppercase={false}
          value={destination}
          onChange={onDestination}
          icon={<MapPin className="text-[#996515]" />}
        />
        <SearchField
          label="Check-in"
          type="date"
          value={checkIn}
          onChange={onCheckIn}
          icon={<CalendarDays className="text-[#996515]" />}
        />
        <SearchField
          label="Check-out"
          type="date"
          value={checkOut}
          onChange={onCheckOut}
          icon={<CalendarDays className="text-[#d4af37]" />}
        />
        <SearchButton loading={loading} data-testid={searchTestId} />
      </SearchFieldsRow>
      <SearchSecondaryRow className="grid-cols-3 max-w-xl">
        <SearchSelect label="Rooms" value={rooms} onChange={onRooms}>
          {[1, 2, 3, 4].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </SearchSelect>
        <SearchSelect label="Adults" value={adults} onChange={onAdults}>
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </SearchSelect>
        <SearchSelect label="Children" value={childrenCount} onChange={onChildren}>
          {[0, 1, 2, 3, 4].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </SearchSelect>
      </SearchSecondaryRow>
    </>
  );
}
