function Bone({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-md bg-bg-3 ${className ?? ""}`}
    />
  );
}

function StatCardSkeleton() {
  return (
    <div className="rounded-[10px] border border-border bg-bg-2 px-4 py-3.5">
      <Bone className="h-7 w-12" />
      <Bone className="mt-2 h-2.5 w-20" />
      <Bone className="mt-1.5 h-2 w-14" />
    </div>
  );
}

function CardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={`rounded-[10px] border border-border bg-bg-2 p-4 ${className ?? ""}`}
    >
      <Bone className="mb-3 h-3 w-28" />
      <Bone className="mb-2 h-2.5 w-full" />
      <Bone className="mb-2 h-2.5 w-5/6" />
      <Bone className="h-2.5 w-3/4" />
    </div>
  );
}

export default function OverviewLoading() {
  return (
    <div className="overflow-y-auto p-6">
      {/* Greeting */}
      <header className="mb-5">
        <Bone className="h-6 w-48" />
        <Bone className="mt-2 h-3.5 w-72" />
      </header>

      {/* Stat cards */}
      <div className="mb-5 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>

      {/* Content grid */}
      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-3">
          <CardSkeleton className="h-40" />
          <CardSkeleton className="h-36" />
        </div>
        <div className="flex flex-col gap-3">
          <CardSkeleton className="h-44" />
          <CardSkeleton className="h-28" />
        </div>
      </div>
    </div>
  );
}
