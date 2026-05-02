function Bone({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded bg-bg-2 ${className ?? ""}`} />
  );
}

export default function SkillsLoading() {
  return (
    <div className="flex h-full min-h-0">
      {/* Left panel — item list */}
      <div className="flex w-64 shrink-0 flex-col gap-2 border-r border-border p-3">
        <Bone className="mb-1 h-7 w-full rounded-md" />
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2 rounded-md p-2">
            <Bone className="h-4 w-4 shrink-0 rounded" />
            <Bone className="h-3 flex-1" />
          </div>
        ))}
      </div>

      {/* Right panel — editor */}
      <div className="flex min-w-0 flex-1 flex-col p-6">
        <Bone className="mb-4 h-5 w-48" />
        <Bone className="mb-2 h-3 w-full" />
        <Bone className="mb-2 h-3 w-5/6" />
        <Bone className="mb-2 h-3 w-full" />
        <Bone className="mb-2 h-3 w-3/4" />
        <Bone className="mb-6 h-3 w-full" />
        <Bone className="mb-2 h-3 w-5/6" />
        <Bone className="mb-2 h-3 w-full" />
        <Bone className="h-3 w-2/3" />
      </div>
    </div>
  );
}
