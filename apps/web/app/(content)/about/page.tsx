import { ContentPage, contentMetadata } from "@/components/ContentPage";

export const metadata = contentMetadata(
  "About ONETRIPS",
  "ONETRIPS is an enterprise travel marketplace for flights and hotels.",
);

export default function AboutPage() {
  return (
    <ContentPage title="About ONETRIPS">
      <p>
        ONETRIPS is a complete travel marketplace for flights and hotels. Search fares, compare stays, pay
        securely, and manage every trip from one account.
      </p>
      <p>
        We operate as an enterprise booking platform with a shared booking engine for customers and agencies.
        Live airline and hotel suppliers connect through provider adapters — the product experience stays the
        same.
      </p>
    </ContentPage>
  );
}
