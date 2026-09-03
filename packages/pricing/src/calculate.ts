export type PricingInput = {
  supplierFare: number;
  supplierTaxes: number;
  markup: number;
  serviceFee: number;
  discount: number;
};

export type PricingResult = {
  customerPrice: number;
  breakdown: PricingInput;
};

export function calculateCustomerPrice(input: PricingInput): PricingResult {
  const customerPrice =
    input.supplierFare + input.supplierTaxes + input.markup + input.serviceFee - input.discount;
  return { customerPrice, breakdown: input };
}
