export type PricingAudienceCode = "B2C" | "B2B";

export type QuoteContext = {
  audience: PricingAudienceCode;
  organizationId?: string;
  supplierId?: string;
  currency?: string;
};

export type FareQuoteInput = QuoteContext & {
  airlineCode?: string;
  origin?: string;
  destination?: string;
  cabin?: string;
  supplierBase: number;
  supplierTaxes: number;
  discount?: number;
};

export type FareQuote = {
  currency: string;
  supplierBase: number;
  supplierTaxes: number;
  markup: number;
  serviceFee: number;
  discount: number;
  commission: number;
  customerPrice: number;
  markupRuleId: string | null;
  serviceFeeRuleIds: string[];
  commissionRuleId: string | null;
};

export type PricableOffer = {
  cabin: string;
  fare: {
    currency: string;
    base: number;
    taxes: number;
    total: number;
    totalLabel: string;
    supplierBase?: number;
    supplierTaxes?: number;
    markup?: number;
    serviceFee?: number;
    discount?: number;
    commission?: number;
  };
  itineraries: Array<{
    segments: Array<{
      airlineCode: string;
      origin: string;
      destination: string;
    }>;
  }>;
};
