import { ContentPage, contentMetadata } from "@/components/ContentPage";

export const metadata = contentMetadata("Privacy Policy", "How ONETRIPS handles personal information.");

export default function PrivacyPage() {
  return (
    <ContentPage title="Privacy Policy">
      <p>
        We collect account details, traveler information, booking history, and payment status to complete travel
        bookings. Passport numbers are encrypted at rest. We do not store raw card numbers.
      </p>
      <p>
        We share traveler and itinerary data with airlines, hotels, and payment providers only as required to fulfill
        a booking. You may request access or correction of your profile from Account.
      </p>
      <p>Marketing messages are optional. You can change that preference from your account when available.</p>
    </ContentPage>
  );
}
