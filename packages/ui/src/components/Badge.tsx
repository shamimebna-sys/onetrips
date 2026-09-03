import type { ReactNode } from "react";

type BadgeProps = {
  children: ReactNode;
  tone?: "neutral" | "gold" | "success" | "danger" | "info";
  className?: string;
};

const tones = {
  neutral: "bg-slate-100 text-slate-600",
  gold: "bg-[#d4af37]/15 text-[#996515]",
  success: "bg-emerald-50 text-emerald-700",
  danger: "bg-red-50 text-red-600",
  info: "bg-sky-50 text-sky-700",
};

export function Badge({ children, tone = "neutral", className = "" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
