import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: "primary" | "gold" | "ghost";
};

const variants = {
  primary:
    "bg-ink text-white hover:bg-gold shadow-lg",
  gold:
    "bg-gold text-white hover:scale-105",
  ghost:
    "bg-transparent text-ink hover:text-gold",
};

export function Button({
  children,
  variant = "primary",
  className = "",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-3 rounded-xl px-6 py-2.5 text-xs font-black uppercase tracking-widest transition-all cursor-pointer disabled:opacity-50 ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
