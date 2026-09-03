type BookingStatusBadgeProps = {
  label: string;
  group?: "upcoming" | "completed" | "cancelled" | "refunds" | string;
};

const TONE: Record<string, string> = {
  upcoming: "bg-emerald-50 text-emerald-700",
  completed: "bg-slate-100 text-slate-600",
  cancelled: "bg-red-50 text-red-700",
  refunds: "bg-amber-50 text-amber-800",
};

export function BookingStatusBadge({ label, group = "upcoming" }: BookingStatusBadgeProps) {
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${TONE[group] ?? TONE.upcoming}`}>
      {label}
    </span>
  );
}
