type AlertProps = {
  children: string;
  variant?: "error" | "success" | "info";
};

const variants = {
  error: "bg-red-50 text-red-600 border-red-100",
  success: "bg-emerald-50 text-emerald-700 border-emerald-100",
  info: "bg-slate-50 text-slate-600 border-slate-100",
};

export function Alert({ children, variant = "error" }: AlertProps) {
  return (
    <div
      role="alert"
      className={`p-4 rounded-2xl mb-6 text-[10px] text-center font-black border uppercase tracking-widest ${variants[variant]}`}
    >
      {children}
    </div>
  );
}
