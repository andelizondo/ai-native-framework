function Bone({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded bg-bg-2 ${className ?? ""}`} />
  );
}

const COLS = 3;
const ROWS = 4;

export default function TemplateEditorLoading() {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      {/* Header — matches template-editor's `border-b ... px-6 py-4`
          eyebrow + title + subtitle so the page doesn't jump. */}
      <header className="flex shrink-0 flex-col border-b border-border bg-bg px-6 py-4">
        <Bone className="h-2.5 w-28" />
        <Bone className="mt-1 h-6 w-56" />
        <Bone className="mt-1 h-3.5 w-72" />
      </header>

      {/* Matrix */}
      <div className="min-h-0 flex-1 overflow-auto p-4">
        <div
          className="mb-2 grid gap-2"
          style={{ gridTemplateColumns: `120px repeat(${COLS}, 1fr)` }}
        >
          <div />
          {Array.from({ length: COLS }).map((_, i) => (
            <Bone key={i} className="h-6 rounded-md" />
          ))}
        </div>

        <div className="flex flex-col gap-2">
          {Array.from({ length: ROWS }).map((_, row) => (
            <div
              key={row}
              className="grid gap-2"
              style={{ gridTemplateColumns: `120px repeat(${COLS}, 1fr)` }}
            >
              <Bone className="h-16 rounded-md" />
              {Array.from({ length: COLS }).map((_, col) => (
                <div
                  key={col}
                  className="flex h-16 items-center rounded-md border border-border p-2"
                >
                  {(row + col) % 3 !== 0 && (
                    <div className="w-full">
                      <Bone className="h-2 w-1/3" />
                    </div>
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
