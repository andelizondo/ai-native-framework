"use client";

import { CheckCircle2, X, XCircle } from "lucide-react";

import { useToastStore } from "@/lib/toast";
import { cn } from "@/lib/utils";

export function Toaster() {
  const { toasts, dismiss } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-label="Notifications"
      className="pointer-events-none fixed bottom-6 right-6 z-[200] flex flex-col gap-2"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="status"
          className={cn(
            "pointer-events-auto flex w-[320px] items-start gap-3 rounded-xl border border-border-hi bg-bg-2 px-4 py-3 shadow-[var(--shadow-canvas)] transition-[transform,opacity] duration-[280ms] ease-out",
            toast.visible
              ? "translate-y-0 opacity-100"
              : "translate-y-3 opacity-0",
          )}
        >
          <span className="mt-px shrink-0">
            {toast.variant === "success" ? (
              <CheckCircle2
                className="h-[15px] w-[15px] text-(color:--pill-complete-d)"
                strokeWidth={2.2}
              />
            ) : (
              <XCircle
                className="h-[15px] w-[15px] text-(color:--pill-blocked-d)"
                strokeWidth={2.2}
              />
            )}
          </span>

          <div className="min-w-0 flex-1">
            <p className="text-[12.5px] font-semibold leading-5 text-t1">{toast.title}</p>
            {toast.description ? (
              <p className="mt-0.5 text-[12px] leading-5 text-t2">{toast.description}</p>
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
      ))}
    </div>
  );
}
