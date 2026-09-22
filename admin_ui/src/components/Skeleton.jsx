export default function Skeleton({ className = "" }) {
  return <div className={`animate-pulse bg-border rounded ${className}`} />;
}

export function SkeletonRows({ count = 3, height = "h-14" }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className={`w-full ${height}`} />
      ))}
    </div>
  );
}
