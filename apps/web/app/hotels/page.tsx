import { Suspense } from "react";
import { HotelResultsClient } from "./HotelResultsClient";

export default async function HotelsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await searchParams;
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-[#d4af37]/20 border-t-[#d4af37] rounded-full animate-spin" />
        </div>
      }
    >
      <HotelResultsClient />
    </Suspense>
  );
}
