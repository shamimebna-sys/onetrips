import { Suspense } from "react";
import { ResultsClient } from "./ResultsClient";

export default async function FlightsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Resolve query params on the server so client navigation is not left
  // behind a root loading fallback while useSearchParams() is still pending.
  await searchParams;
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-[#d4af37]/20 border-t-[#d4af37] rounded-full animate-spin" />
        </div>
      }
    >
      <ResultsClient />
    </Suspense>
  );
}
