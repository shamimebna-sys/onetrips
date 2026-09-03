import { ContentPage, contentMetadata } from "@/components/ContentPage";

export const metadata = contentMetadata("Terms and Conditions", "ONETRIPS terms of use.");

export default function TermsPage() {
  return (
    <ContentPage title="Terms and Conditions">
      <p>
        By creating an account or completing a booking on ONETRIPS you agree to these terms. Bookings are contracts
        between you and ONETRIPS for the arrangement of travel services supplied by airlines, hotels, and payment
        providers.
      </p>
      <p>
        Fares and rooms are subject to availability and revalidation. Prices can change until you confirm payment.
        You are responsible for traveler names, passport details, and travel documents matching the booking.
      </p>
      <p>
        These terms do not replace airline conditions of carriage or hotel policies, which also apply to your trip.
      </p>
    </ContentPage>
  );
}
