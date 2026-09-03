import type { SelectHTMLAttributes, ReactNode } from "react";

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  error?: string;
  children: ReactNode;
};

export function Select({ label, error, className = "", id, children, ...props }: SelectProps) {
  const selectId = id ?? label.toLowerCase().replace(/\s+/g, "-");
  const errorId = error ? `${selectId}-error` : undefined;

  return (
    <div className="min-w-0 space-y-2">
      <label htmlFor={selectId} className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
        {label}
      </label>
      <select
        id={selectId}
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId}
        className={`w-full min-w-0 bg-muted border p-4 rounded-2xl font-bold text-ink outline-none focus:ring-2 ring-gold transition-all ${error ? "border-red-200" : "border-slate-100"} ${className}`}
        {...props}
      >
        {children}
      </select>
      {error ? (
        <p id={errorId} role="alert" className="text-[10px] font-black uppercase tracking-widest text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
