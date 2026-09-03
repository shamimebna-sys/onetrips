import type { ReactNode } from "react";

type CardProps = {
  children: ReactNode;
  className?: string;
};

export function Card({ children, className = "" }: CardProps) {
  return (
    <div className={`bg-white rounded-[45px] shadow-[0_20px_80px_rgba(15,23,42,0.06)] border border-gray-50 ${className}`}>
      {children}
    </div>
  );
}
