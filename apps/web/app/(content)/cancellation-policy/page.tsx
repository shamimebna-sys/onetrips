import { ContentPage, contentMetadata } from "@/components/ContentPage";

export const metadata = contentMetadata("Cancellation Policy", "How cancellations work on ONETRIPS.");

export default function CancellationPolicyPage() {
  return (
    <ContentPage title="Cancellation Policy">
      <p>
        You may cancel a booking from the booking page when the current status allows it. Unpaid holds are cancelled
        immediately. After payment, cancellation follows supplier rules and may incur fees.
      </p>
      <p>
        Issued tickets may need to be voided before a refund can start. Failed supplier bookings are cancelled without
        a ticket.
      </p>
    </ContentPage>
  );
}
