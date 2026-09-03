"use client";

import { useRef, type ButtonHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";
import {
  ArrowRightLeft,
  ChevronDown,
  Hotel,
  Loader2,
  MoveRight,
  Plane,
  Repeat,
  Search,
} from "lucide-react";

/** Exact homepage search container classes. */
export const SEARCH_PANEL_CLASS =
  "w-full min-w-0 bg-white p-2 md:p-4 rounded-[3rem] shadow-[0_40px_100px_-20px_rgba(212,175,55,0.2)] border border-slate-100 text-left text-slate-900 font-sans";

/** Homepage tab pill. flex-wrap + max-w-full prevent overflow on 375px. */
export const SEARCH_TAB_PILL =
  "flex flex-wrap gap-2 p-2 bg-slate-50 w-fit max-w-full rounded-2xl";

function tabClass(active: boolean) {
  return `flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all cursor-pointer ${
    active ? "bg-white text-[#996515] shadow-sm" : "text-slate-500 hover:text-slate-700"
  }`;
}

export function SearchPanel({
  children,
  className = "",
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <div id={id} className={`${SEARCH_PANEL_CLASS} ${className}`}>
      {children}
    </div>
  );
}

type TabItem<T extends string> = { id: T; label: string; icon: ReactNode };

function SearchTabs<T extends string>({
  tabs,
  value,
  onChange,
  ariaLabel,
  className,
}: {
  tabs: TabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  ariaLabel: string;
  className?: string;
}) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const focusTab = (nextIndex: number) => {
    const next = (nextIndex + tabs.length) % tabs.length;
    const tab = tabs[next];
    if (!tab) return;
    onChange(tab.id);
    refs.current[next]?.focus();
  };

  return (
    <div role="tablist" aria-label={ariaLabel} className={className}>
      {tabs.map((tab, index) => {
        const selected = tab.id === value;
        return (
          <button
            key={tab.id}
            ref={(el) => {
              refs.current[index] = el;
            }}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            data-testid={tab.id === "flights" || tab.id === "hotels" ? `product-${tab.id}` : undefined}
            onClick={() => onChange(tab.id)}
            onKeyDown={(event) => {
              if (event.key === "ArrowRight" || event.key === "ArrowDown") {
                event.preventDefault();
                focusTab(index + 1);
              } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
                event.preventDefault();
                focusTab(index - 1);
              } else if (event.key === "Home") {
                event.preventDefault();
                focusTab(0);
              } else if (event.key === "End") {
                event.preventDefault();
                focusTab(tabs.length - 1);
              }
            }}
            className={tabClass(selected)}
          >
            {tab.icon} {tab.label}
          </button>
        );
      })}
    </div>
  );
}

export function SearchProductTabs({
  value,
  onChange,
  className,
}: {
  value: "flights" | "hotels";
  onChange: (id: "flights" | "hotels") => void;
  className?: string;
}) {
  return (
    <SearchTabs
      ariaLabel="Product"
      className={className ?? `${SEARCH_TAB_PILL} ml-4 mt-4 mb-4`}
      value={value}
      onChange={onChange}
      tabs={[
        { id: "flights", label: "Flights", icon: <Plane size={14} /> },
        { id: "hotels", label: "Hotels", icon: <Hotel size={14} /> },
      ]}
    />
  );
}

export type SearchTripType = "one-way" | "round-trip" | "multi-city";

export function SearchTripTypeTabs({
  value,
  onChange,
  types = ["one-way", "round-trip", "multi-city"],
  className,
}: {
  value: SearchTripType;
  onChange: (id: SearchTripType) => void;
  types?: SearchTripType[];
  className?: string;
}) {
  const all: TabItem<SearchTripType>[] = [
    { id: "one-way", label: "One Way", icon: <MoveRight size={14} /> },
    { id: "round-trip", label: "Round Trip", icon: <Repeat size={14} /> },
    { id: "multi-city", label: "Multi-City", icon: <ArrowRightLeft size={14} /> },
  ];
  return (
    <SearchTabs
      ariaLabel="Trip type"
      className={className ?? `${SEARCH_TAB_PILL} ml-4 mt-4 mb-6`}
      value={value}
      onChange={onChange}
      tabs={all.filter((tab) => types.includes(tab.id))}
    />
  );
}

type SearchFieldProps = {
  label: string;
  placeholder?: string;
  value: string;
  onChange: (val: string) => void;
  icon: ReactNode;
  type?: string;
  uppercase?: boolean;
  testId?: string;
  required?: boolean;
  name?: string;
};

/** Homepage SearchInput — shared field chrome for dates and text. */
export function SearchField({
  label,
  placeholder,
  value,
  onChange,
  icon,
  type = "text",
  uppercase,
  testId,
  required,
  name,
}: SearchFieldProps) {
  const isDate = type === "date";
  const useUpper = uppercase ?? !isDate;
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="relative min-w-0 w-full text-left p-5 bg-slate-50 rounded-3xl border border-slate-100 focus-within:ring-2 ring-[#d4af37] transition-all">
      <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-2">{label}</span>
      <div className="flex min-w-0 items-center gap-3">
        <span aria-hidden className="shrink-0">
          {icon}
        </span>
        <input
          ref={inputRef}
          type={type}
          name={name}
          required={required}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onClick={() => {
            if (!isDate) return;
            try {
              inputRef.current?.showPicker?.();
            } catch {
              /* native date field still works */
            }
          }}
          data-testid={testId ?? `search-${label.toLowerCase()}`}
          className={`min-w-0! max-w-full flex-1 relative bg-transparent text-base font-bold text-slate-800 outline-none w-full placeholder:text-slate-300 ${isDate ? "cursor-pointer" : ""} ${useUpper ? "uppercase" : ""} ${
            isDate
              ? "[color-scheme:light] overflow-hidden [field-sizing:fixed] [&::-webkit-datetime-edit]:p-0 [&::-webkit-datetime-edit]:min-w-0 [&::-webkit-datetime-edit]:max-w-full [&::-webkit-datetime-edit]:overflow-hidden [&::-webkit-datetime-edit-fields-wrapper]:p-0 [&::-webkit-inner-spin-button]:hidden [&::-webkit-calendar-picker-indicator]:hidden"
              : ""
          }`}
          style={isDate ? { minWidth: 0, width: "100%" } : undefined}
        />
      </div>
    </div>
  );
}

type SearchSelectProps = {
  label: string;
  value: string;
  onChange: (val: string) => void;
  children: ReactNode;
} & Omit<SelectHTMLAttributes<HTMLSelectElement>, "value" | "onChange" | "children">;

export function SearchSelect({ label, value, onChange, children, className = "", ...rest }: SearchSelectProps) {
  return (
    <label className={`block min-w-0 text-left ${className}`}>
      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</span>
      <span className="relative mt-2 block min-w-0">
        <select
          {...rest}
          className="w-full min-w-0 appearance-none bg-slate-50 p-4 pr-10 rounded-2xl font-bold text-slate-800 outline-none focus-visible:ring-2 ring-[#d4af37] cursor-pointer"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          {children}
        </select>
        <ChevronDown
          size={16}
          aria-hidden
          className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-500"
        />
      </span>
    </label>
  );
}

export const CABIN_OPTIONS = [
  { value: "ECONOMY", label: "Economy" },
  { value: "PREMIUM_ECONOMY", label: "Premium economy" },
  { value: "BUSINESS", label: "Business" },
  { value: "FIRST", label: "First" },
] as const;

export function PassengerOptions() {
  return (
    <>
      {[1, 2, 3, 4, 5, 6].map((n) => (
        <option key={n} value={n}>
          {n} adult{n > 1 ? "s" : ""}
        </option>
      ))}
    </>
  );
}

export function CabinOptions() {
  return (
    <>
      {CABIN_OPTIONS.map((row) => (
        <option key={row.value} value={row.value}>
          {row.label}
        </option>
      ))}
    </>
  );
}

type SearchButtonProps = {
  loading?: boolean;
  children?: ReactNode;
  variant?: "inline" | "block";
} & ButtonHTMLAttributes<HTMLButtonElement>;

export function SearchButton({
  loading = false,
  children,
  variant = "inline",
  className = "",
  disabled,
  type = "submit",
  ...rest
}: SearchButtonProps) {
  const layout = variant === "inline" ? "h-22 w-full" : "w-full md:w-64 py-6 shadow-xl font-black uppercase tracking-widest text-xs";
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`bg-slate-900 text-white rounded-3xl flex items-center justify-center gap-3 hover:bg-[#d4af37] transition-all disabled:opacity-50 cursor-pointer focus-visible:outline-none focus-visible:ring-2 ring-[#d4af37] ${layout} ${className}`}
      {...rest}
    >
      {loading ? (
        <Loader2 className="animate-spin" />
      ) : (
        children ?? (
          <>
            <Search size={22} className="stroke-[3px]" />
            <span className="font-black uppercase tracking-widest text-xs">Search</span>
          </>
        )
      )}
    </button>
  );
}

export function SearchFieldsRow({
  children,
  className = "md:grid-cols-4",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`grid grid-cols-1 gap-4 min-w-0 items-stretch ${className}`}>{children}</div>;
}

/** Homepage round-trip / multi-city search CTA row. */
export function SearchSubmitRow({ children }: { children: ReactNode }) {
  return <div className="mt-8 flex justify-end">{children}</div>;
}

export function SearchSecondaryRow({
  children,
  className = "grid-cols-2 max-w-xl ml-4",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`mt-4 grid min-w-0 gap-4 ${className}`}>{children}</div>;
}
