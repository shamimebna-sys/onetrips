export type RefundFare = {
  currency: string;
  total: number;
  totalLabel: string;
};

export type RefundPenalty = {
  type: "CHANGE" | "REFUND" | "NOSHOW";
  amount: number;
};

export type RefundableOffer = {
  refundable: boolean;
  fare: RefundFare;
  fareRules?: { penalties?: RefundPenalty[] };
  penalties?: RefundPenalty[];
};

export function formatFareMoney(currency: string, amount: number) {
  if (currency === "BDT") return `৳ ${Math.round(amount).toLocaleString("en-US")}`;
  return `${currency} ${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function refundPenaltyAmount(offer: RefundableOffer) {
  const penalties = offer.fareRules?.penalties ?? offer.penalties ?? [];
  const refund = penalties.find((row) => row.type === "REFUND");
  if (!refund || typeof refund.amount !== "number" || Number.isNaN(refund.amount)) return null;
  return refund.amount;
}

export function refundPresentation(offer: RefundableOffer) {
  if (!offer.refundable) {
    return {
      refundable: false as const,
      amountText: formatFareMoney(offer.fare.currency, 0),
      feeLabel: "Cancellation",
      feeText: "Non-refundable",
    };
  }

  const penalty = refundPenaltyAmount(offer);
  if (penalty !== null && typeof offer.fare.total === "number" && !Number.isNaN(offer.fare.total)) {
    return {
      refundable: true as const,
      amountText: formatFareMoney(offer.fare.currency, Math.max(0, offer.fare.total - penalty)),
      feeLabel: "Cancellation fee",
      feeText: formatFareMoney(offer.fare.currency, penalty),
    };
  }

  return {
    refundable: true as const,
    amountText: "Unavailable",
    feeLabel: "Cancellation fee",
    feeText: "Unavailable",
  };
}
