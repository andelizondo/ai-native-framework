function Bone({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded bg-bg-2 ${className ?? ""}`} />
  );
}

export default function SettingsLoading() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-10">
      <Bone className="h-5 w-24" />
      <Bone className="h-3 w-80" />
      <Bone className="h-3 w-60" />
    </div>
  );
}
