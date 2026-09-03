type SkeletonProps = {
  className?: string;
};

export function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div
      aria-hidden
      className={`animate-pulse rounded-2xl bg-slate-100 ${className}`}
    />
  );
}

export function SkeletonBlock({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3" role="status" aria-label="Loading">
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton key={index} className={`h-16 ${index === rows - 1 ? "w-2/3" : "w-full"}`} />
      ))}
      <span className="sr-only">Loading</span>
    </div>
  );
}
