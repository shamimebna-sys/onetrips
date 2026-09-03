import type { ReactNode } from "react";

type SearchFieldProps = {
  label: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  icon: ReactNode;
  type?: string;
};

export function SearchField({
  label,
  placeholder,
  value,
  onChange,
  icon,
  type = "text",
}: SearchFieldProps) {
  return (
    <div className="text-left p-5 bg-slate-50 rounded-3xl border border-slate-100 focus-within:ring-2 ring-[#d4af37] transition-all">
      <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-2">
        {label}
      </span>
      <div className="flex items-center gap-3">
        {icon}
        <input
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="bg-transparent font-bold text-slate-800 outline-none w-full uppercase placeholder:text-slate-300"
        />
      </div>
    </div>
  );
}
