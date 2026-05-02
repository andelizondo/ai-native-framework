function Bone({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded bg-bg-2 ${className ?? ""}`} />
  );
}

export default function EventsLoading() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-10">
      <Bone className="h-5 w-28" />
      <Bone className="h-3 w-72" />
      <Bone className="h-3 w-56" />
    </div>
  );
}
