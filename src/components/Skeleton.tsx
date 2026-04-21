import { HTMLAttributes } from 'react';
import { cn } from '../lib/cn';

interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  shimmer?: boolean;
}

export function Skeleton({
  className,
  shimmer = true,
  ...props
}: SkeletonProps) {
  return (
    <div
      className={cn(
        'ui-skeleton rounded-xl',
        shimmer && 'ui-skeleton-shimmer',
        className
      )}
      {...props}
    />
  );
}

export function SidebarSkeleton() {
  return (
    <div className="h-full flex flex-col rounded-[28px] border border-slate-200/80 bg-white/90 p-4 shadow-[0_28px_60px_-40px_rgba(15,23,42,0.35)] backdrop-blur-xl">
      <div className="mb-5 flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-2xl" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-24 rounded-md" />
          <Skeleton className="h-3 w-16 rounded-md" />
        </div>
      </div>

      <Skeleton className="h-11 w-full rounded-2xl" />

      <div className="mt-6 flex-1 space-y-3">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="flex items-center gap-3 px-2 py-1">
            <Skeleton className="h-8 w-8 rounded-xl" />
            <Skeleton
              className={cn(
                'h-4 rounded-md',
                index % 3 === 0 ? 'w-28' : index % 3 === 1 ? 'w-36' : 'w-24'
              )}
            />
          </div>
        ))}
      </div>

      <div className="space-y-3 border-t border-slate-200/80 pt-4">
        <Skeleton className="h-10 w-full rounded-2xl" />
        <Skeleton className="h-10 w-full rounded-2xl" />
      </div>
    </div>
  );
}

export function EditorSkeleton() {
  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-8 md:px-10">
      <div className="rounded-[32px] border border-slate-200/80 bg-white/85 px-6 py-8 shadow-[0_28px_60px_-40px_rgba(15,23,42,0.35)] backdrop-blur-xl md:px-10 md:py-10">
        <Skeleton className="h-12 w-2/3 rounded-2xl md:h-14" />
        <Skeleton className="mt-3 h-5 w-40 rounded-lg" />

        <div className="mt-10 space-y-4">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="flex gap-4 rounded-2xl px-2 py-3">
              <Skeleton className="mt-1 h-8 w-8 rounded-xl" />
              <div className="flex-1 space-y-3">
                <Skeleton
                  className={cn(
                    'h-4 rounded-md',
                    index % 2 === 0 ? 'w-11/12' : 'w-9/12'
                  )}
                />
                {index % 2 === 0 && <Skeleton className="h-4 w-8/12 rounded-md" />}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function WorkspaceSkeleton() {
  return (
    <div className="flex h-screen bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.9),_rgba(241,245,249,0.96)_35%,_rgba(226,232,240,0.75)_100%)] p-3 md:p-4">
      <div className="hidden w-[300px] shrink-0 lg:block">
        <SidebarSkeleton />
      </div>
      <div className="flex-1 overflow-hidden rounded-[28px] border border-slate-200/70 bg-white/60 shadow-[0_28px_60px_-40px_rgba(15,23,42,0.4)] backdrop-blur-xl">
        <EditorSkeleton />
      </div>
    </div>
  );
}
