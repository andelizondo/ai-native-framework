"use client";

import { useState } from "react";
import { CheckCircle2, ChevronDown, X, XCircle } from "lucide-react";

import { useToastStore } from "@/lib/toast";
import { cn } from "@/lib/utils";

export function Toaster() {
  const { toasts, dismiss } = useToastStore();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-label="Notifications"
      className="pointer-events-none fixed right-6 top-[60px] z-[200] flex flex-col gap-2"
    >
      {toasts.map((toast) => {
        const accent =
          toast.variant === "success"
            ? "var(--pill-complete-d)"
            : "var(--pill-blocked-d)";
        const isOpen = expanded[toast.id] === true;
        return (
          <div
            key={toast.id}
            role="status"
            className={cn(
              "pointer-events-auto relative flex w-[340px] items-start gap-3 overflow-hidden rounded-xl border border-border-hi bg-bg-2 px-4 py-3 pl-[15px] shadow-[var(--shadow-canvas)] transition-[transform,opacity] duration-[280ms] ease-out",
              toast.visible
                ? "translate-y-0 opacity-100"
                : "-translate-y-3 opacity-0",
            )}
          >
            <span
              aria-hidden
              className="absolute left-0 top-0 h-full w-[3px]"
              style={{ backgroundColor: accent }}
            />

            <span className="mt-px shrink-0">
              {toast.variant === "success" ? (
                <CheckCircle2
                  className="h-[15px] w-[15px]"
                  style={{ color: accent }}
                  strokeWidth={2.2}
                />
              ) : (
                <XCircle
                  className="h-[15px] w-[15px]"
                  style={{ color: accent }}
                  strokeWidth={2.2}
                />
              )}
            </span>

            <div className="min-w-0 flex-1">
              <p className="text-[12.5px] font-semibold leading-5 text-t1">
                {toast.title}
              </p>
              {toast.description ? (
                <p className="mt-0.5 text-[12px] leading-5 text-t2">
                  {toast.description}
                </p>
              ) : null}

              {toast.detail ? (
                <>
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() =>
                      setExpanded((prev) => ({ ...prev, [toast.id]: !isOpen }))
                    }
                    className="mt-1 flex items-center gap-1 text-[11px] font-medium text-t3 transition hover:text-t1 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
                  >
                    <ChevronDown
                      className={cn(
                        "h-3 w-3 transition-transform duration-150",
                        isOpen && "rotate-180",
                      )}
                    />
                    {isOpen ? "Hide details" : "Show details"}
                  </button>
                  {isOpen ? (
                    <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words border-t border-border pt-2 font-mono text-[11px] leading-[1.45] text-t3">
                      {toast.detail}
                    </pre>
                  ) : null}
                </>
              ) : null}
            </div>

            <button
              type="button"
              aria-label="Dismiss notification"
              onClick={() => dismiss(toast.id)}
              className="-mr-1 -mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-t3 transition hover:bg-bg-4 hover:text-t1 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
