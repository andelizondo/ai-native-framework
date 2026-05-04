function Bone({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded bg-bg-2 ${className ?? ""}`} />
  );
}

function CardSkeleton() {
  return (
    <div className="flex min-h-[92px] items-center gap-3 rounded-[16px] border border-border bg-bg px-4 py-4">
      <Bone className="h-10 w-10 shrink-0 rounded-md" />
      <div className="min-w-0 flex-1">
        <Bone className="h-3.5 w-1/2" />
        <Bone className="mt-2 h-2.5 w-4/5" />
      </div>
    </div>
  );
}

export default function PlaybooksLoading() {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="shrink-0 border-b border-border bg-bg px-6 py-5">
        <Bone className="h-2.5 w-20" />
        <Bone className="mt-2 h-5 w-44" />
        <Bone className="mt-2 h-3 w-72" />
      </div>

      <div className="shrink-0 border-b border-border bg-bg px-6 py-3">
        <div className="flex items-center justify-between gap-3">
          <Bone className="h-9 w-full max-w-[320px] rounded-md" />
          <Bone className="h-8 w-[120px] shrink-0 rounded-md" />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto bg-bg-2">
        <div className="p-3 md:p-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
