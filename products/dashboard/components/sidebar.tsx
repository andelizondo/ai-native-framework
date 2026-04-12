"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Lightbulb, PenLine, Code2, LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";
import { emitEvent } from "@/lib/events";
import { useAnalytics } from "@/lib/analytics/events";

const phases = [
  {
    id: "ideation",
    label: "Ideation",
    href: "/ideation",
    icon: Lightbulb,
    accent: "text-amber-500",
    activeBg: "bg-amber-50",
  },
  {
    id: "design",
    label: "Design",
    href: "/design",
    icon: PenLine,
    accent: "text-violet-500",
    activeBg: "bg-violet-50",
  },
  {
    id: "implementation",
    label: "Implementation",
    href: "/implementation",
    icon: Code2,
    accent: "text-emerald-500",
    activeBg: "bg-emerald-50",
  },
] as const;

export function Sidebar() {
  const pathname = usePathname();
  const { capture } = useAnalytics();

  function handlePhaseClick(phase: (typeof phases)[number]["id"]) {
    emitEvent("dashboard.phase_navigated", { phase }); // audit pipeline
    capture("dashboard.phase_navigated", { phase });   // PostHog
  }

  return (
    <aside className="flex w-60 flex-col border-r border-slate-200 bg-[#f8fafc]">
      {/* Brand */}
      <div className="flex h-14 items-center gap-2.5 border-b border-slate-200 px-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-900 text-white">
          <LayoutDashboard className="h-4 w-4" />
        </div>
        <span className="text-sm font-semibold tracking-tight text-slate-900">
          AI-Native
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex flex-col gap-1 p-3">
        <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
          Phases
        </p>

        {phases.map(({ id, label, href, icon: Icon, accent, activeBg }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={id}
              href={href}
              onClick={() => handlePhaseClick(id)}
              className={cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all",
                isActive
                  ? cn(activeBg, "text-slate-900 shadow-sm")
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              )}
            >
              <Icon
                className={cn(
                  "h-4 w-4 shrink-0 transition-colors",
                  isActive ? accent : cn(accent, "group-hover:opacity-100")
                )}
              />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="mt-auto border-t border-slate-200 p-4">
        <p className="text-[11px] text-slate-400">
          v0.1 · Planning phase
        </p>
      </div>
    </aside>
  );
}
