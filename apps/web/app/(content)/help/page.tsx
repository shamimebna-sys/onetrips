import Link from "next/link";
import { ContentPage, contentMetadata } from "@/components/ContentPage";

export const metadata = contentMetadata("Help", "Find answers and contact ONETRIPS support.");

export default function HelpPage() {
  return (
    <ContentPage title="Help">
      <p>Search flights and hotels from the home page, sign in to finish a booking, and manage trips from Account.</p>
      <ul className="list-disc space-y-2 pl-5">
        <li>
          <Link href="/faq" className="font-black text-ink">
            Frequently asked questions
          </Link>
        </li>
        <li>
          <Link href="/account/support" className="font-black text-ink">
            Contact support about a booking
          </Link>
        </li>
        <li>
          <Link href="/cancellation-policy" className="font-black text-ink">
            Cancellation policy
          </Link>
        </li>
        <li>
          <Link href="/refund-policy" className="font-black text-ink">
            Refund policy
          </Link>
        </li>
      </ul>
    </ContentPage>
  );
}
