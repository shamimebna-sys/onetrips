"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  positionAnchoredDropdown,
  preserveInProgressAirportQuery,
  type DropdownAnchor,
} from "@onetrips/catalog/airport-search";

type Airport = {
  iataCode: string;
  name: string;
  city: { name: string; country: { name: string } };
};

type Props = {
  label: string;
  value: string;
  onChange: (iata: string) => void;
  icon: React.ReactNode;
  testId?: string;
  showPlaceName?: boolean;
  prominent?: boolean;
};

export function AirportPicker({ label, value, onChange, icon, testId, showPlaceName = false, prominent = false }: Props) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const [airports, setAirports] = useState<Airport[]>([]);
  const [active, setActive] = useState(0);
  const [placeName, setPlaceName] = useState("");
  const [menu, setMenu] = useState<DropdownAnchor | null>(null);
  const [mounted, setMounted] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const inputId = useId();
  const fieldTestId = testId ?? `search-${label.toLowerCase()}`;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setQuery((current) => preserveInProgressAirportQuery(current, value));
  }, [value]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 1) {
      setAirports([]);
      return;
    }
    const timer = setTimeout(() => {
      fetch(`/api/catalog/airports?q=${encodeURIComponent(q)}`)
        .then((res) => res.json())
        .then((data) => {
          const list = data.airports ?? [];
          setAirports(list);
          setActive(0);
          const match = list.find((row: Airport) => row.iataCode === value.toUpperCase());
          if (match) setPlaceName(`${match.city.name}`);
        });
    }, 180);
    return () => clearTimeout(timer);
  }, [query, value]);

  const updateMenu = useCallback(() => {
    const el = box.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const next = positionAnchoredDropdown(
      { top: rect.top, left: rect.left, width: rect.width, height: rect.height, bottom: rect.bottom },
      { width: window.innerWidth, height: window.innerHeight },
    );
    setMenu((current) => {
      if (
        current &&
        current.top === next.top &&
        current.left === next.left &&
        current.width === next.width &&
        current.maxHeight === next.maxHeight &&
        current.placement === next.placement &&
        current.transform === next.transform
      ) {
        return current;
      }
      return next;
    });
  }, []);

  const showList = open && airports.length > 0;

  useEffect(() => {
    if (!showList) {
      setMenu(null);
      return;
    }
    const frame = window.requestAnimationFrame(() => updateMenu());
    const onWin = () => updateMenu();
    window.addEventListener("resize", onWin);
    window.addEventListener("scroll", onWin, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", onWin);
      window.removeEventListener("scroll", onWin, true);
    };
  }, [showList, updateMenu, airports.length, query]);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (box.current?.contains(target) || listRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const select = (airport: Airport) => {
    onChange(airport.iataCode);
    setQuery(airport.iataCode);
    setPlaceName(airport.city.name);
    setOpen(false);
    inputRef.current?.focus();
  };

  const commit = (airport: Airport, event: React.SyntheticEvent) => {
    event.preventDefault();
    event.stopPropagation();
    select(airport);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActive((current) => Math.min(current + 1, Math.max(airports.length - 1, 0)));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((current) => Math.max(current - 1, 0));
      return;
    }
    if (event.key === "Enter" && open && airports[active]) {
      event.preventDefault();
      event.stopPropagation();
      select(airports[active]);
    }
  };

  const list = showList && menu && mounted ? (
    <ul
      ref={listRef}
      id={listId}
      role="listbox"
      data-testid={`${fieldTestId}-list`}
      className="fixed z-50 box-border h-auto max-h-72 overflow-x-hidden overflow-y-auto bg-white rounded-2xl border border-slate-100 py-1 shadow-xl [scrollbar-gutter:stable] [scrollbar-width:thin] [scrollbar-color:#e2e8f0_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-200"
      style={{
        top: menu.top,
        left: menu.left,
        width: menu.width,
        minWidth: menu.width,
        maxWidth: menu.width,
        maxHeight: menu.maxHeight,
        transform: menu.transform,
      }}
    >
      {airports.slice(0, 8).map((airport, index) => (
        <li key={airport.iataCode} role="presentation">
          <button
            type="button"
            id={`${listId}-${airport.iataCode}`}
            role="option"
            aria-selected={index === active}
            className={`grid w-full grid-cols-[3rem_minmax(0,1fr)] items-center gap-x-3 px-4 py-2.5 pr-3 text-left text-slate-800 ${index === active ? "bg-slate-50" : "hover:bg-slate-50"}`}
            onMouseEnter={() => setActive(index)}
            onMouseDown={(event) => commit(airport, event)}
            onClick={(event) => commit(airport, event)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                commit(airport, event);
              }
            }}
          >
            <span className="w-12 shrink-0 font-black tabular-nums text-slate-900">{airport.iataCode}</span>
            <span
              className="min-w-0 truncate text-xs font-medium leading-5 text-slate-500"
              title={`${airport.name} — ${airport.city.name}, ${airport.city.country.name}`}
            >
              {airport.city.name}, {airport.city.country.name}
            </span>
          </button>
        </li>
      ))}
    </ul>
  ) : null;

  return (
    <div
      ref={box}
      data-airport-picker=""
      className={`relative min-w-0 w-full text-left transition-all ${showList ? "z-20" : ""} ${
        prominent
          ? "rounded-2xl border border-line bg-field p-4 focus-within:ring-2 ring-gold-accent"
          : "rounded-3xl border border-slate-100 bg-slate-50 p-5 focus-within:ring-2 ring-[#d4af37]"
      }`}
    >
      <label htmlFor={inputId} className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-2">
        {label}
      </label>
      <div className="flex items-center gap-3">
        <span aria-hidden className="shrink-0">{icon}</span>
        <div className="min-w-0 flex-1">
          <input
            ref={inputRef}
            id={inputId}
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={open && airports[active] ? `${listId}-${airports[active].iataCode}` : undefined}
            value={query}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
            onChange={(event) => {
              setQuery(event.target.value.toUpperCase());
              onChange(event.target.value.slice(0, 3).toUpperCase());
              setPlaceName("");
              setOpen(true);
            }}
            placeholder="DAC"
            autoComplete="off"
            data-testid={fieldTestId}
            className={`min-w-0! bg-transparent outline-none w-full uppercase placeholder:text-slate-300 ${
              prominent ? "text-2xl font-black tracking-tight text-navy" : "text-base font-bold text-slate-800"
            }`}
          />
          {showPlaceName && placeName ? (
            <p className="truncate text-xs font-medium text-copy-muted" title={placeName}>
              {placeName}
            </p>
          ) : null}
        </div>
      </div>
      {list && createPortal(list, document.body)}
    </div>
  );
}
