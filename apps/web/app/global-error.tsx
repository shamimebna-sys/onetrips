"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#996515]">ONETRIPS</p>
          <h1 className="text-3xl font-black uppercase tracking-tighter mt-3">Something went wrong</h1>
          <p className="text-sm text-slate-500 mt-3">The page could not be loaded. Your booking data is safe.</p>
          {error.digest && <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-4">Ref {error.digest}</p>}
          <button
            type="button"
            onClick={() => reset()}
            className="mt-8 bg-slate-900 text-white px-8 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-[#d4af37]"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
