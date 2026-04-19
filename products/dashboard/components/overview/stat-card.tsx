import { cn } from "@/lib/utils";

/**
 * StatCard — one of the four numbers across the top of the Overview.
 *
 * Visual contract: prototype `.stat-card` block in
 * `/tmp/design-canvas/ai-native-dashboard/project/Process Canvas.html`
 * (lines 372-377). The delta row recolors based on `tone`:
 *   - `up`   → emerald (`#34d399`)
 *   - `warn` → amber  (`#fbbf24`)
 *   - `mute` → `--t3` (used for neutral metadata like "0 / 0 tasks")
 *
 * Light-theme contrast note: hint text uses `text-t2` (and the tone
 * classes pin colors that read on both bg-2 and bg-light-2). PR-3's
 * empty stub bumped from `--t3` to `--t2` for the same reason.
 */

export type StatCardTone = "up" | "warn" | "mute";

export interface StatCardProps {
  value: string;
  label: string;
  hint: string;
  tone?: StatCardTone;
}

const toneClass: Record<StatCardTone, string> = {
  up: "text-[color:#34d399]",
  warn: "text-[color:#fbbf24]",
  mute: "text-t2",
};

export function StatCard({
  value,
  label,
  hint,
  tone = "mute",
}: StatCardProps) {
  return (
    <div className="rounded-[10px] border border-border bg-bg-2 px-4 py-3.5">
      <div className="font-mono text-[26px] font-extrabold leading-none tracking-tight text-t1">
        {value}
      </div>
      <div className="mt-1.5 text-[11px] text-t2">{label}</div>
      <div className={cn("mt-1 font-mono text-[10px]", toneClass[tone])}>
        {hint}
      </div>
    </div>
  );
}
