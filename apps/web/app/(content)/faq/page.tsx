import { ContentPage, contentMetadata } from "@/components/ContentPage";

export const metadata = contentMetadata("FAQ", "Common questions about booking with ONETRIPS.");

const faqs = [
  ["How do I search flights?", "Enter origin, destination, and dates on the home page, then compare fares, baggage, and refundability."],
  ["How do I search hotels?", "Open the Hotels tab, enter a destination and stay dates, then choose a room rate."],
  ["Do I need an account to book?", "Yes. Sign in so we can attach travelers, payments, tickets, and invoices to your account."],
  ["How do I cancel?", "Open the booking from My Trips. Cancellation is available when the booking state allows it."],
  ["When will I receive my ticket?", "E-tickets and hotel vouchers are issued after payment succeeds and the supplier confirms the booking."],
];

export default function FaqPage() {
  return (
    <ContentPage title="FAQ">
      {faqs.map(([question, answer]) => (
        <div key={question}>
          <h2 className="text-sm font-black uppercase tracking-widest text-ink">{question}</h2>
          <p className="mt-2">{answer}</p>
        </div>
      ))}
    </ContentPage>
  );
}
