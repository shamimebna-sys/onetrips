"use client";

import { CalendarDays, MapPin, PlaneTakeoff, Plus, Trash2 } from "lucide-react";
import { AirportPicker } from "@/app/flights/AirportPicker";
import { SearchField } from "./SearchChrome";
import {
  addMultiCitySegment,
  removeMultiCitySegment,
  updateMultiCitySegment,
  type MultiCitySegment,
} from "./flightSearchQuery";

/** Homepage Multi-City segment editor — canonical UI for every customer search entry. */
export function MultiCitySegments({
  segments,
  onChange,
}: {
  segments: MultiCitySegment[];
  onChange: (segments: MultiCitySegment[]) => void;
}) {
  return (
    <div className="space-y-4 text-left" data-testid="multi-city-segments">
      {segments.map((seg, idx) => (
        <div
          key={idx}
          className="grid grid-cols-1 md:grid-cols-10 gap-3 items-end bg-slate-50/50 p-4 rounded-3xl border border-slate-100"
        >
          <div className="md:col-span-3">
            <AirportPicker
              label={`Origin ${idx + 1}`}
              value={seg.origin}
              onChange={(origin) => onChange(updateMultiCitySegment(segments, idx, { origin }))}
              icon={<PlaneTakeoff size={18} className="text-[#996515]" />}
              testId={`search-origin-${idx + 1}`}
            />
          </div>
          <div className="md:col-span-3">
            <AirportPicker
              label={`Dest ${idx + 1}`}
              value={seg.destination}
              onChange={(destination) => onChange(updateMultiCitySegment(segments, idx, { destination }))}
              icon={<MapPin size={18} className="text-[#996515]" />}
              testId={`search-dest-${idx + 1}`}
            />
          </div>
          <div className="md:col-span-3">
            <SearchField
              label="Date"
              type="date"
              value={seg.date}
              onChange={(date) => onChange(updateMultiCitySegment(segments, idx, { date }))}
              icon={<CalendarDays size={18} className="text-[#996515]" />}
              testId={`search-date-${idx + 1}`}
            />
          </div>
          <div className="md:col-span-1 flex justify-center pb-4">
            {idx > 1 ? (
              <button
                type="button"
                data-testid={`search-remove-segment-${idx + 1}`}
                onClick={() => onChange(removeMultiCitySegment(segments, idx))}
                className="p-3 text-red-400 hover:bg-red-50 rounded-full transition cursor-pointer"
              >
                <Trash2 size={20} />
              </button>
            ) : null}
          </div>
        </div>
      ))}
      <button
        type="button"
        data-testid="search-add-segment"
        onClick={() => onChange(addMultiCitySegment(segments))}
        className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-[#996515] border-2 border-[#d4af37]/20 px-6 py-3 rounded-2xl hover:bg-[#d4af37]/5 transition-all cursor-pointer"
      >
        <Plus size={16} /> Add Another Flight
      </button>
    </div>
  );
}
