type PriceBreakdownProps = {
  currency: string;
  base?: number;
  taxes?: number;
  markup?: number;
  serviceFee?: number;
  discount?: number;
  total: number;
};

function money(currency: string, amount: number) {
  if (currency === "BDT") return `৳ ${Math.round(amount).toLocaleString("en-US")}`;
  return `${currency} ${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function PriceBreakdown({ currency, base = 0, taxes = 0, markup = 0, serviceFee = 0, discount = 0, total }: PriceBreakdownProps) {
  const rows = [
    ["Supplier / base fare", base],
    ["Taxes", taxes],
    ["Markup", markup],
    ["Service fee", serviceFee],
    ["Discount", -discount],
  ].filter(([, amount]) => Number(amount) !== 0);

  return (
    <div className="rounded-3xl bg-slate-50 p-5 text-sm" data-testid="price-breakdown">
      {rows.map(([label, amount]) => (
        <div key={String(label)} className="flex justify-between py-1 font-medium text-slate-600">
          <span>{label}</span>
          <span>{money(currency, Number(amount))}</span>
        </div>
      ))}
      <div className="mt-2 flex justify-between border-t border-slate-200 pt-3 font-black uppercase tracking-widest">
        <span>Total</span>
        <span>{money(currency, total)}</span>
      </div>
    </div>
  );
}
