import Link from "next/link";
import { ContentPage, contentMetadata } from "@/components/ContentPage";

export const metadata = contentMetadata("Contact ONETRIPS", "Contact ONETRIPS customer support.");

export default function ContactPage() {
  return (
    <ContentPage title="Contact">
      <p>Need help with a booking, payment, or ticket? Start with Help and Support, or email our team.</p>
      <p>
        Email:{" "}
        <a className="font-black text-ink" href="mailto:support@onetrips.com">
          support@onetrips.com
        </a>
      </p>
      <p>
        Hours: Sunday–Thursday, 9:00–18:00 BST. For an existing booking, sign in and open{" "}
        <Link href="/account/support" className="font-black text-gold-dark">
          Account Support
        </Link>
        .
      </p>
    </ContentPage>
  );
}
