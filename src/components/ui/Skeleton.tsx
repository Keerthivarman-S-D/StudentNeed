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
      className="flex flex-col rounded-2xl border border-[#dedcd4] bg-white p-3.5 shadow-none"
    >
      {/* Image Skeleton */}
      <div className="relative aspect-[16/10] w-full overflow-hidden rounded-xl bg-zinc-100 flex items-center justify-center">
        <Skeleton className="h-full w-full rounded-none bg-zinc-200/70" />
      </div>

      {/* Content Skeleton */}
      <div className="flex flex-1 flex-col pt-3 px-0.5 space-y-2.5">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-16 rounded-full bg-zinc-200" />
          <Skeleton className="h-5 w-5 rounded-full bg-zinc-200" />
        </div>

        <Skeleton className="h-5 w-3/4 rounded-md bg-zinc-200" />
        <Skeleton className="h-3.5 w-1/2 rounded-md bg-zinc-200" />
        <Skeleton className="h-6 w-16 rounded-md bg-zinc-200" />
        <Skeleton className="h-3.5 w-2/3 rounded-md bg-zinc-200 mt-1" />
      </div>
    </div>
  );
}
