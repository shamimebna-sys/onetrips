"use client";

import { FlightTripSearch } from "./FlightTripSearch";
import { HotelSearchFields } from "./HotelSearchFields";
import type { MultiCitySegment } from "./flightSearchQuery";
import {
  SearchPanel,
  SearchProductTabs,
  SearchTripTypeTabs,
  type SearchTripType,
} from "./SearchChrome";

export type CustomerFlightSearch = {
  tripType: SearchTripType;
  origin: string;
  destination: string;
  departureDate: string;
  returnDate: string;
  adults: string;
  cabin: string;
  segments: MultiCitySegment[];
  onTripTypeChange: (id: SearchTripType) => void;
  onOrigin: (value: string) => void;
  onDestination: (value: string) => void;
  onDeparture: (value: string) => void;
  onReturn: (value: string) => void;
  onAdults: (value: string) => void;
  onCabin: (value: string) => void;
  onSegments: (segments: MultiCitySegment[]) => void;
  onSearch: () => void;
  onSwap?: () => void;
  formTestId?: string;
  searchTestId?: string;
};

export type CustomerHotelSearch = {
  destination: string;
  checkIn: string;
  checkOut: string;
  rooms: string;
  adults: string;
  children: string;
  onDestination: (value: string) => void;
  onCheckIn: (value: string) => void;
  onCheckOut: (value: string) => void;
  onRooms: (value: string) => void;
  onAdults: (value: string) => void;
  onChildren: (value: string) => void;
  onSearch: () => void;
  formTestId?: string;
  searchTestId?: string;
};

/**
 * Canonical customer search widget — extracted from the homepage.
 * Homepage, /account, /flights, and /hotels all render this component.
 */
export function CustomerSearch({
  product,
  onProductChange,
  flights,
  hotels,
  loading = false,
  panelId,
  panelClassName = "",
}: {
  product: "flights" | "hotels";
  onProductChange: (id: "flights" | "hotels") => void;
  flights?: CustomerFlightSearch;
  hotels?: CustomerHotelSearch;
  loading?: boolean;
  panelId?: string;
  panelClassName?: string;
}) {
  return (
    <SearchPanel id={panelId} className={panelClassName}>
      <SearchProductTabs value={product} onChange={onProductChange} />
      {product === "flights" && flights ? (
        <>
          <SearchTripTypeTabs value={flights.tripType} onChange={flights.onTripTypeChange} />
          <form
            onSubmit={(event) => {
              event.preventDefault();
              flights.onSearch();
            }}
            className="p-4"
            data-testid={flights.formTestId}
          >
            <FlightTripSearch
              tripType={flights.tripType}
              origin={flights.origin}
              destination={flights.destination}
              departureDate={flights.departureDate}
              returnDate={flights.returnDate}
              adults={flights.adults}
              cabin={flights.cabin}
              segments={flights.segments}
              onOrigin={flights.onOrigin}
              onDestination={flights.onDestination}
              onDeparture={flights.onDeparture}
              onReturn={flights.onReturn}
              onAdults={flights.onAdults}
              onCabin={flights.onCabin}
              onSegments={flights.onSegments}
              onSwap={flights.onSwap}
              loading={loading}
              searchTestId={flights.searchTestId ?? "search-submit"}
            />
          </form>
        </>
      ) : null}
      {product === "hotels" && hotels ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            hotels.onSearch();
          }}
          className="p-4"
          data-testid={hotels.formTestId}
        >
          <HotelSearchFields
            destination={hotels.destination}
            checkIn={hotels.checkIn}
            checkOut={hotels.checkOut}
            rooms={hotels.rooms}
            adults={hotels.adults}
            childrenCount={hotels.children}
            onDestination={hotels.onDestination}
            onCheckIn={hotels.onCheckIn}
            onCheckOut={hotels.onCheckOut}
            onRooms={hotels.onRooms}
            onAdults={hotels.onAdults}
            onChildren={hotels.onChildren}
            loading={loading}
            searchTestId={hotels.searchTestId ?? "search-hotel-submit"}
          />
        </form>
      ) : null}
    </SearchPanel>
  );
}
