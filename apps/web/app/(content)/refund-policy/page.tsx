import { ContentPage, contentMetadata } from "@/components/ContentPage";

export const metadata = contentMetadata("Refund Policy", "How ONETRIPS processes refunds.");

export default function RefundPolicyPage() {
  return (
    <ContentPage title="Refund Policy">
      <p>
        Refunds follow the fare or room rules of the supplier and the booking state on ONETRIPS. Non-refundable fares
        and rooms may not be refundable after ticketing.
      </p>
      <p>
        If payment is captured and the booking later fails or is cancelled where the rules allow, we initiate a refund
        through the original payment method or wallet. Partial refunds leave the remainder open until settled.
      </p>
      <p>Refund status is shown on the booking page. Processing times depend on the payment provider.</p>
    </ContentPage>
  );
}
