import type { InputHTMLAttributes, ReactNode } from "react";

const ROW = "grid min-h-9 grid-cols-[1rem_minmax(0,1fr)_1.75rem] items-center gap-x-2.5";
const CONTROL = "size-4 shrink-0 justify-self-center accent-navy";

export function FilterOptionRow({
  control,
  label,
  count,
}: {
  control: ReactNode;
  label: string;
  count?: number;
}) {
  return (
    <label className={ROW}>
      {control}
      <span className="min-w-0 truncate text-sm leading-5 font-medium text-navy" title={label}>
        {label}
      </span>
      <span className="w-full text-right text-sm leading-none font-semibold tabular-nums text-copy-muted">
        {count ?? ""}
      </span>
    </label>
  );
}

export function FilterControlCheckbox(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input type="checkbox" className={CONTROL} {...props} />;
}

export function FilterControlRadio(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input type="radio" className={CONTROL} {...props} />;
}
