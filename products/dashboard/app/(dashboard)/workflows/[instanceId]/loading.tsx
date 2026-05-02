function Bone({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded bg-bg-2 ${className ?? ""}`} />
  );
}

const COLS = 3;
const ROWS = 4;

export default function WorkflowInstanceLoading() {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      {/* Top bar area (below the shared TopBar) */}
      <div className="flex h-10 shrink-0 items-center gap-3 border-b border-border px-4">
        <Bone className="h-3 w-32" />
        <Bone className="ml-auto h-6 w-16" />
      </div>

      {/* Matrix */}
      <div className="min-h-0 flex-1 overflow-auto p-4">
        {/* Role header row */}
        <div
          className="mb-2 grid gap-2"
          style={{ gridTemplateColumns: `120px repeat(${COLS}, 1fr)` }}
        >
          <div />
          {Array.from({ length: COLS }).map((_, i) => (
            <Bone key={i} className="h-6 rounded-md" />
          ))}
        </div>

        {/* Stage rows */}
        <div className="flex flex-col gap-2">
          {Array.from({ length: ROWS }).map((_, row) => (
            <div
              key={row}
              className="grid gap-2"
              style={{ gridTemplateColumns: `120px repeat(${COLS}, 1fr)` }}
            >
              {/* Stage label */}
              <Bone className="h-16 rounded-md" />
              {/* Task cells */}
              {Array.from({ length: COLS }).map((_, col) => (
                <div
                  key={col}
                  className="h-16 rounded-md border border-border bg-bg-2 p-2"
                >
                  {(row + col) % 3 !== 0 && (
                    <>
                      <Bone className="mb-1.5 h-2.5 w-3/4 animate-pulse" />
                      <Bone className="h-2 w-1/2 animate-pulse" />
                    </>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
