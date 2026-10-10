import * as React from "react";
import { cn } from "../../lib/utils";

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {}

export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "rounded-md bg-zinc-200/80 motion-safe:animate-pulse motion-reduce:animate-none",
        className
      )}
      {...props}
    />
  );
}

export function ListingCardSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="flex flex-col overflow-hidden rounded-2xl border border-brand-border bg-white shadow-xs"
    >
      {/* Image Skeleton */}
      <div className="relative aspect-square w-full bg-zinc-100 flex items-center justify-center overflow-hidden">
        <Skeleton className="h-full w-full rounded-none bg-zinc-200/70" />
        <div className="absolute left-3 top-3 flex gap-1.5">
          <Skeleton className="h-5 w-16 rounded-full bg-zinc-300/80" />
        </div>
        <div className="absolute right-3 top-3">
          <Skeleton className="h-8 w-8 rounded-full bg-zinc-300/80" />
        </div>
      </div>

      {/* Content Skeleton */}
      <div className="flex flex-1 flex-col p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <Skeleton className="h-5 w-3/4 rounded-md" />
          <Skeleton className="h-5 w-12 rounded-md" />
        </div>

        <Skeleton className="h-4 w-1/2 rounded-md" />

        <div className="mt-auto pt-3 border-t border-zinc-100 flex items-center justify-between">
          <Skeleton className="h-3.5 w-20 rounded-md" />
          <Skeleton className="h-5 w-14 rounded-md" />
        </div>
      </div>
    </div>
  );
}
