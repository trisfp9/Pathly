"use client";

export default function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`bg-white/5 rounded-card shimmer ${className}`}
    />
  );
}

export function CardSkeleton() {
  return (
    <div className="glass-card p-6 space-y-4">
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-2/3" />
      <Skeleton className="h-8 w-24 mt-4" />
    </div>
  );
}
