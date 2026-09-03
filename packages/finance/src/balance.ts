export type LedgerLine = {
  amount: string;
  type: "DEBIT" | "CREDIT" | "DEPOSIT" | "REFUND" | "COMMISSION" | "SERVICE_FEE" | "MARKUP" | "ADJUSTMENT" | "GATEWAY_FEE";
};

export function deriveBalance(entries: readonly LedgerLine[]): number {
  return entries.reduce((sum, entry) => {
    const amount = Number(entry.amount);
    if (Number.isNaN(amount)) return sum;
    if (entry.type === "DEBIT" || entry.type === "GATEWAY_FEE" || entry.type === "SERVICE_FEE") return sum - amount;
    return sum + amount;
  }, 0);
}
