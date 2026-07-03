/**
 * Shimmering placeholder for Suspense fallbacks and loading states.
 * Matches the dark-glass dialect: bg-white/5 + border-white/10.
 */
export function Skeleton({
  className = "",
  rounded = "rounded-lg",
}: {
  className?: string;
  rounded?: string;
}) {
  return (
    <div
      className={`animate-pulse bg-white/5 border border-white/5 ${rounded} ${className}`}
    />
  );
}

export function SkeletonText({
  lines = 3,
  className = "",
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className="h-3"
          rounded="rounded"
        />
      ))}
    </div>
  );
}

export default Skeleton;
