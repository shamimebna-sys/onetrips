import type { InputHTMLAttributes, ReactNode } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  icon?: ReactNode;
  error?: string;
  hint?: string;
};

export function Input({ label, icon, className = "", id, error, hint, ...props }: InputProps) {
  const inputId = id ?? label.toLowerCase().replace(/\s+/g, "-");
  const errorId = error ? `${inputId}-error` : undefined;
  const hintId = hint ? `${inputId}-hint` : undefined;

  return (
    <div className="space-y-2">
      <label htmlFor={inputId} className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
        {label}
      </label>
      <div className="relative">
        {icon ? (
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gold pointer-events-none" aria-hidden>
            {icon}
          </div>
        ) : null}
        <input
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={[errorId, hintId].filter(Boolean).join(" ") || undefined}
          className={`w-full bg-muted border p-4 ${icon ? "pl-12" : ""} rounded-2xl font-bold text-ink outline-none focus:ring-2 ring-gold transition-all ${error ? "border-red-200" : "border-slate-100"} ${className}`}
          {...props}
        />
      </div>
      {hint && !error ? (
        <p id={hintId} className="text-[10px] font-bold text-slate-400">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-[10px] font-black uppercase tracking-widest text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
