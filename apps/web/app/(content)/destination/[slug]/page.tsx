import Link from "next/link";
import { notFound } from "next/navigation";
import { ContentPage, contentMetadata } from "@/components/ContentPage";
import { DESTINATIONS, destinationBySlug } from "@/lib/destinations";

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return DESTINATIONS.map((row) => ({ slug: row.slug }));
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const destination = destinationBySlug(slug);
  if (!destination) return contentMetadata("Destination", "ONETRIPS destination guide.");
  return contentMetadata(destination.name, destination.blurb);
}

export default async function DestinationPage({ params }: Props) {
  const { slug } = await params;
  const destination = destinationBySlug(slug);
  if (!destination) notFound();

  return (
    <ContentPage title={destination.name} kicker={destination.country}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "TouristDestination",
            name: destination.name,
            description: destination.blurb,
          }),
        }}
      />
      <p>{destination.blurb}</p>
      <p>
        Search {destination.code} flights from the homepage, or open hotel stays for {destination.name}.
      </p>
      <p className="flex gap-4">
        <Link href={`/?from=DAC&to=${destination.code}`} className="text-gold-dark font-black uppercase tracking-widest text-[10px]">
          Search flights
        </Link>
        <Link href={`/hotels?city=${destination.code}`} className="text-gold-dark font-black uppercase tracking-widest text-[10px]">
          Search hotels
        </Link>
      </p>
    </ContentPage>
  );
}
