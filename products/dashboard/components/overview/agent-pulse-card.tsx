import { cn } from "@/lib/utils";

/**
 * Agent Pulse card — static seed data for PR-6.
 *
 * The live agent runtime wires up in PR-8 (Task Drawer / Agent Run
 * panel). For now, this card mirrors the prototype's `AGENTS` seed
 * (`pc-components.jsx` lines 775-781) so the Overview shows what the
 * eventual surface will look like and PR-8 has a stable target to
 * replace.
 *
 * Visual contract: prototype `.agent-row` block (`Process Canvas.html`
 * lines 406-415).
 */

type AgentStatus = "active" | "waiting" | "idle";

interface AgentRow {
  /**
   * Stable identifier used as the React key. Two agents could share a
   * `name` (e.g. multiple "PM Agent" runs once PR-8 wires the live
   * runtime), so the row must carry its own id rather than reusing the
   * display label.
   */
  id: string;
  name: string;
  icon: string;
  status: AgentStatus;
  task: string;
}

// Seed data mirrors the prototype OverviewScreen so QA and analytics
// can compare against the design source. PR-8 (AEL-51) replaces this
// with `repo.listAgentRuns()` once that surface exists.
const SEED_AGENTS: ReadonlyArray<AgentRow> = [
  {
    id: "agent-pm",
    name: "PM Agent",
    icon: "📋",
    status: "active",
    task: "Backlog refinement · CompanyX",
  },
  {
    id: "agent-designer",
    name: "Designer Agent",
    icon: "🎨",
    status: "waiting",
    task: "Awaiting design review approval",
  },
  {
    id: "agent-project",
    name: "Project Agent",
    icon: "🗂️",
    status: "active",
    task: "Scope planning · CompanyX",
  },
  {
    id: "agent-devops",
    name: "DevOps Agent",
    icon: "🔧",
    status: "active",
    task: "Infra requirements · CompanyX",
  },
  {
    id: "agent-strategist",
    name: "Strategist Agent",
    icon: "🧭",
    status: "active",
    task: "ICP definition · GTM",
  },
];

const pulseClass: Record<AgentStatus, string> = {
  active:
    "bg-[color:#10b981] shadow-[0_0_6px_rgba(16,185,129,0.5)]",
  waiting:
    "bg-[color:#f59e0b] shadow-[0_0_6px_rgba(245,158,11,0.4)]",
  idle: "bg-border-2",
};

export interface AgentPulseCardProps {
  /** Override seed agents in tests / future live wiring. */
  agents?: ReadonlyArray<AgentRow>;
}

export function AgentPulseCard({ agents = SEED_AGENTS }: AgentPulseCardProps) {
  return (
    <section
      data-testid="overview-agent-pulse"
      className="overflow-hidden rounded-[10px] border border-border bg-bg-2"
    >
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-[12px] font-semibold text-t1">Agent pulse</h2>
        <span className="font-mono text-[10px] text-t3">
          {agents.filter((a) => a.status === "active").length} active
        </span>
      </header>

      {agents.length === 0 ? (
        <p className="px-4 py-7 text-center text-[12px] text-t2">
          No agents running.
        </p>
      ) : (
        <ul className="divide-y divide-border-2">
          {agents.map((agent) => (
            <li
              key={agent.id}
              className="flex items-center gap-2.5 px-4 py-2.5"
            >
              <span
                aria-hidden
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] bg-bg-4 text-[14px]"
              >
                {agent.icon}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[12px] font-semibold text-t1">
                  {agent.name}
                </div>
                <div className="truncate font-mono text-[11px] text-t3">
                  {agent.task}
                </div>
              </div>
              <span
                aria-label={`status ${agent.status}`}
                className={cn(
                  "block h-[7px] w-[7px] shrink-0 rounded-full",
                  pulseClass[agent.status],
                )}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
