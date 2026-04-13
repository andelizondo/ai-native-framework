# AI-native operating framework

**Version:** 0.1 (initial)  
**Normative prose.** Machine-validated rules and instances take precedence when they exist; see §5.

---

## 0. Document control

### 0.1 Audience

- **Agents:** Primary executors of this framework—configuration, retrieval, and actions **MUST** align with normative sections below and with validated artifacts where present.
- **Human operators:** Governance, approvals, strategy, and override—**MUST** retain authority defined in §3 and §11.

### 0.2 Authority ladder

1. JSON Schema under `spec/schema/`  
2. Validated YAML/JSON under `spec/examples/` and (when introduced) `spec/processes/`  
3. `spec/policy/event-taxonomy.yaml`  
4. `interfaces/interfaces.yaml`  
5. Versioned procedure playbooks under `ai/playbooks/*.md` where a repository maintains them — **MUST NOT** contradict 1–4  
6. This Markdown file and other `docs/*` (explanatory narrative; **MUST NOT** override 1–5)

Repository-local agent files: root `AGENTS.md` plus `ai/PLAYBOOKS.md`, `ai/SKILLS.md`, `ai/skills/`, `ai/MEMORY.md`, and related indices are routing and bootstrap surfaces unless promoted into machine-validated schema or policy. They **SHOULD** align with items 1–5 and **MUST NOT** contradict them (including normative procedure playbooks under `ai/playbooks/*.md`).

### 0.3 Conformance keywords

- **MUST / MUST NOT:** Hard requirement. Violation blocks release unless a human waiver is recorded in the decision log.  
- **SHOULD / SHOULD NOT:** Default; deviation **MUST** be justified in the decision log.  
- **MAY:** Optional.

---

## 1. Identity and scope

### 1.1 What this framework is

An **AI-native operating system** for building and running **product-led companies**: spec-driven, event-observable, human-governed, **provider-agnostic** at the core.

### 1.2 What this framework is not

- A single vendor product or model.  
- A claim of full autonomy.  
- Unstructured chat as the system of record.  
- A substitute for legal, financial, or security review where applicable.

### 1.3 Definitions

- **Internal positioning:** System for turning stated intent into a functioning company.  
- **External positioning — variant A:** Company-building OS: agent-operated execution, human-guided strategy.  
- **External positioning — variant B:** Coordinated agents operating product-led companies under explicit human governance.

---

## 2. Core principles

| Principle | Normative requirement |
|-----------|----------------------|
| **AI-first** | AI **MUST** be a first-class subsystem: capabilities, evals, failure handling—not an ad-hoc add-on. |
| **API-first & modular** | Boundaries **MUST** be composable, replaceable, observable (interfaces, events, health). |
| **Leverage** | Small teams **SHOULD** achieve large output via agents; risk **MUST NOT** be concealed. |
| **Event-driven** | Material state changes **MUST** emit **structured events** for analytics, automation, audit. |
| **Persistent context** | Decisions and learnings **MUST** live in structured, versioned artifacts—not only transient chat. |
| **Provider-agnostic** | Business logic **MUST NOT** depend on one LLM vendor, agent IDE, or orchestration engine. |
| **Reliability over novelty** | Prefer proven patterns where failure cost is high (money, data, access, reputation). |
| **Auditability** | Significant automation **SHOULD** be traceable (`correlation_id`, workflow run id, decision id). |

---

## 3. Division of labor

### 3.1 Default allocation

| Role | Responsibility |
|------|----------------|
| **Agent capabilities** | Execution, coordination, iteration, analysis within declared constraints. |
| **Human operators** | Strategy, taste, ambiguity resolution, approval of irreversible or high-stakes outcomes. |

**Rule:** *Agents propose and execute; human operators decide under uncertainty.*

### 3.2 Leverage target (non-normative ratio)

A **~90% automated execution / ~10% human judgment** split is an **aspirational leverage target**, not proof of autonomy. Actual ratios **MUST** be governed by machine-readable **judgment policy** (§11): checkpoints, confidence thresholds, escalation.

### 3.3 Mandatory human involvement

Agents **MUST** escalate or halt when **any** holds:

- Ambiguity cannot be resolved from spec or policy.  
- Stakes are high (legal, financial, reputation, security, broad credential use).  
- Confidence is below the step’s threshold.  
- Strategy or positioning must change.  
- Required approval is missing.

In a personal repository operated by a single human, the framework **MAY** define that repository owner as the terminal human checkpoint for specific medium-risk actions once the evidence bundle is complete. This is still human-governed; it is not equivalent to removing the checkpoint.

---

## 4. End-to-end value chain

The framework covers the full path from intent to operating company:

```mermaid
flowchart LR
  INTENT[Intent constraints]
  DISC[Discovery]
  PROD[Product definition]
  BUILD[Build ship]
  GTM[Go to market]
  OPS[Operations]
  FB[Feedback learning]
  INTENT --> DISC --> PROD --> BUILD --> GTM --> OPS --> FB
  FB --> DISC
  FB --> PROD
```

| Stage | Purpose | Primary artifacts |
|-------|---------|-------------------|
| **Intent** | Goals, constraints, risk appetite | Company/process spec (when present); decision log |
| **Discovery** | Opportunities, ICP, positioning | Research outputs; updated spec; events |
| **Product** | MVP scope, requirements, model | Product/slice spec; data model; event catalog |
| **Build & ship** | Vertical delivery | Code, infra, tests, telemetry |
| **Go-to-market** | Launch, demand, narrative | Assets, campaigns, metrics definitions |
| **Operations** | Support, billing, internal ops | Playbooks, events, dashboards |
| **Feedback** | Learning loop | Metrics, qualitative signals, spec updates |

---

## 5. System architecture (six layers)

### 5.1 Layer stack

1. **Provider abstraction** — Model routing, tool adapters, secrets boundaries; vendors **MAY** be swapped without rewriting orchestration semantics.  
2. **Agent skill layer** — Units with goals, tool allowlists, context policy, constraints, escalation. **Skills, not mascots:** no vendor names in business rules.  
3. **Orchestration layer** — Decomposition, assignment, handoffs, dependencies, durable workflow state. **Not** equivalent to a single free-form model thread.  
4. **Workflow library** — Versioned workflows (§7); primary encoded operating knowledge.  
5. **Human judgment layer** — Approvals, thresholds, audit, rollback (§11).  
6. **Feedback & learning** — Signal ingestion; proposed spec/process updates; **MUST NOT** silently overwrite human-approved truth without policy.

### 5.2 Reference diagram

```mermaid
flowchart TB
  subgraph judgment [Human_judgment]
    APP[approvals thresholds]
    AUD[audit rollback]
  end
  subgraph orch [Orchestration]
    DEC[decompose assign]
    HO[handoffs deps]
  end
  subgraph caps [Agent_skills]
    EX[execute analyze]
  end
  subgraph lib [Workflow_library]
    WF[workflows]
  end
  subgraph prov [Provider_abstraction]
    RT[models tools]
  end
  subgraph store [Durable_specs]
    SP[product slice]
    PR[process company]
  end
  APP --> DEC
  DEC --> EX
  EX --> HO
  HO --> WF
  EX --> RT
  orch --> store
  WF --> store
  judgment --> orch
```

---

## 6. Skills in the AI layer

### 6.1 Executors

Task runners—LLM-backed or deterministic—**MUST** operate inside skill constraints.

### 6.2 Skill types (non-exhaustive catalog)

Strategist, Researcher, Product, Builder (engineering), Designer, Growth, Sales ops, Support, Finance/Ops. Each skill **MUST** eventually declare in machine form: tools, data access, escalation paths, forbidden actions.

### 6.2.1 Repository-local context bundle

Framework-aligned repositories **SHOULD** expose a lightweight agent context surface: **root `AGENTS.md`** as the common first-read entry point, plus an **`ai/` directory** for everything else agents load progressively:

- `AGENTS.md` — bootstrap contract for agents entering the repository (typically the only agent file at repo root).
- `ai/SKILLS.md` — low-cost skill discovery index and routing surface for role- and task-oriented harnesses.
- `ai/skills/` — on-demand skill bodies for workflows that need more than index-level guidance.
- `ai/PLAYBOOKS.md` — low-cost playbook discovery index; points to unitary procedures under `ai/playbooks/`.
- `ai/playbooks/` — on-demand procedure playbooks for recurring governance and automation loops.
- `ai/MEMORY.md` — durable repository memory with update rules.

This surface is the provider-agnostic replacement for hidden system prompts or IDE-only conventions. It gives agents a shared, versioned operating map while keeping the distinction clear: skills route and shape agent execution, while playbooks hold the canonical procedures for recurring workflows. The normative source of truth remains in schemas, policy, interfaces, and playbook files under `ai/playbooks/`.

Minimum requirements:

- `AGENTS.md` **MUST** define the repo authority ladder, canonical commands, change discipline, and escalation conditions (including where `ai/` lives).
- `ai/SKILLS.md` **SHOULD** map recurring workflows to named skills or procedures, each with triggers, inputs, outputs, and links to deeper docs, `ai/playbooks/*.md`, or `ai/skills/*.md`.
- `ai/skills/` **SHOULD** hold the deeper skill bodies so agents load only the skill they selected instead of the whole catalog.
- `ai/PLAYBOOKS.md` **SHOULD** list each versioned procedure playbook with triggers, inputs, outputs, and a link into `ai/playbooks/*.md`.
- `ai/MEMORY.md` **MUST** distinguish stable facts from temporary working state and **MUST NOT** become an unbounded log dump.
- Changes to these files **SHOULD** be reviewed whenever repo policy, architecture, workflows, or terminology changes.

### 6.3 Orchestrator

The **orchestrator** is **infrastructure** (workflow engine, graph runtime, queue worker graph, etc.), **not** a chat persona. It **MUST** implement: decomposition, state, retries, handoffs per `interfaces/interfaces.yaml` and future orchestration schemas.

---

## 7. Workflow library

### 7.1 Normative role

The Workflow Library is the **encoded moat**: reusable, versioned procedures—treated with the same rigor as code (review, test, changelog).

### 7.2 Categories

| Category | Typical contents |
|----------|------------------|
| **Discovery** | Market research, opportunity mapping, ICP, positioning |
| **Product** | MVP scoping, PRD-style outputs, prioritization, QA flows |
| **Build** | Implementation loops, testing, release |
| **Go-to-market** | Launch, landing pages, content, outbound |
| **Operations** | Onboarding, support, reporting, pricing experiments, internal ops |

The repository-local `ai/PLAYBOOKS.md` and `ai/playbooks/` files are the procedure side of this library; `ai/SKILLS.md` and `ai/skills/` are the adjacent routing side for agents. Both surfaces are operator-facing indices into the same operating system, but they serve different roles: playbooks hold canonical procedures, while skills help agents choose and execute the right workflow. Workflow definitions may remain in Markdown initially, but each index **SHOULD** point to the canonical playbook file or schema-backed process artifact for each recurring workflow.

Common repository-local playbooks typically include governed repository setup, pull request execution, agent context maintenance, framework review, and release management.

The canonical workflow inventory for a repository-local agent bundle **SHOULD** live in `ai/PLAYBOOKS.md`. This framework document defines what a workflow library is and how it fits the operating system; it should not duplicate the repository's playbook catalog.

### 7.3 Workflow record shape (each entry SHOULD declare)

- **Inputs** and **outputs** (artifact types).  
- **Steps** and **dependencies**.  
- **Skills** invoked per step.  
- **Tools** and data sources.  
- **Events** emitted.  
- **Metrics** affected.  
- **Human checkpoints** and threshold references.

*Process and workflow schemas **MAY** be introduced after product-spec schemas, but once they exist they **MUST** follow the same validation discipline.*

---

## 8. Product development lifecycle

### 8.1 Phases

1. **Ideation** — Problem, user, goal, constraints, success metrics, risks. **Exit:** bounded scope; success metric defined.  
2. **Design** — Spec system (§9). **Exit:** schema-valid spec; event catalog stubbed; observability plan.  
3. **Implementation** — **Vertical slices** only: UI + API + persistence + AI surface (if any) + telemetry in one increment. **Exit:** deployed; observable; spec updated.  
4. **Feedback** — Measure; promote assumptions to facts or invalidate; re-enter ideation/design as needed.

### 8.2 Slice maturity labels

- **V1:** Fastest path; prove value.  
- **V2:** Production-ready, maintainable.  
- **V3:** Scalable / extensible where load or org complexity demands.

V3 patterns **MUST NOT** be introduced without decision-log rationale.

### 8.3 Cadence

**SHOULD** maintain: build → ship → measure → learn → iterate on a weekly rhythm.

### 8.4 Parallel maintenance (Cycle C)

Each shipped slice **SHOULD** land together with: updated validated spec(s), event catalog deltas when behavior is new, observability updates when measurement changes. Deferred spec work **MUST** be recovered in a **time-boxed extraction** immediately after if shipping precedes documentation.

---

## 9. Spec system (product and slice)

### 9.1 Required blocks (machine-validated)

| Block | Contents |
|-------|----------|
| **Ideation** | Problem, user, goal, constraints, metrics, risks |
| **Design** | Objective, requirements, system design, tooling decisions, assumptions, facts |
| **Data model** | Entities, fields, relationships, PII classification |
| **Events** | Catalog: name, semantics, versions, payload JSON Schema, PII, idempotency, ordering, emitters |
| **Observability** | Logging strategy, error tracking, core metrics |
| **Context recovery** | Canonical summary, key decisions, domain glossary |
| **Decision log** | Dated entries with alternatives |

Slice instances **MUST** include `slice_id` and `parent_product_id` per schema.

### 9.2 Event rules

- Names **MUST** conform to `spec/policy/event-taxonomy.yaml`.  
- Payloads **MUST** be JSON-serializable; breaking changes **MUST** version and deprecate.  
- Emissions **MUST** include envelope fields per policy (e.g. `occurred_at`, `emitted_by`, `correlation_id`, schema version).  
- Workflow and governance events (e.g. approval requested/granted/denied, step completed) **SHOULD** use the same taxonomy discipline.

---

## 10. Tooling reference (default stack)

Bindings below are **recommended defaults** for greenfield implementations; the framework **MUST** remain valid if individual components are substituted behind the abstraction layer.

| Concern | Default choice | Role |
|---------|----------------|------|
| **Source control / PR governance** | GitHub + branch protection + configurable AI code review (or equivalent) | Reviews, approvals, merge policy, audit trail |
| **Frontend** | Next.js + Tailwind + shadcn/ui | Product UI, marketing surfaces |
| **Application API** | Next.js route handlers or Node / FastAPI | Business logic, auth integration |
| **Data** | PostgreSQL; Supabase for auth/storage/APIs | System of record |
| **AI execution** | Multiple LLM APIs + coding agents as tools | Generation, analysis, implementation |
| **Orchestration (maturity 3+)** | LangGraph or equivalent | Stateful workflows behind §5.1 layer 3 |
| **Product analytics** | PostHog (or equivalent) | Funnels, experiments, feature usage |
| **Errors** | Sentry (or equivalent) | Exceptions, regressions |
| **Hosting** | Vercel + managed DB / Supabase | Deploy and scale |
| **Validation CI** | Node + AJV + YAML parser | Schema validation on `spec/examples/*` |
| **Unit / component tests** | Vitest + React Testing Library + MSW | Fast, spec-anchored verification in CI |
| **E2E / browser** | Playwright | Critical-path and release E2E, accessibility, and visual regression |

### 10.1 Repository tooling (reference layout)

Typical layout for a framework-aligned repo:

| Path | Function |
|------|----------|
| `spec/schema/` | JSON Schema definitions |
| `spec/examples/` | Validated product/slice instances |
| `spec/policy/` | Event taxonomy and related policy YAML |
| `spec/processes/` | *(Introduce)* validated process/workflow instances |
| `templates/` | Generators and empty templates (e.g. slice spec) |
| `interfaces/interfaces.yaml` | Logical tool contracts |
| `AGENTS.md` | Repository-local bootstrap instructions at repo root; authority map and execution rules for agents |
| `ai/PLAYBOOKS.md` | Playbook discovery index under `ai/`; links into `ai/playbooks/` |
| `ai/playbooks/` | On-demand procedure playbooks loaded from `ai/PLAYBOOKS.md` |
| `ai/SKILLS.md` | Skill discovery index under `ai/`; maps recurring work to skills, playbooks, and artifacts |
| `ai/skills/` | On-demand skill bodies loaded only when selected from `ai/SKILLS.md` |
| `ai/MEMORY.md` | Durable working memory: current state, constraints, glossary, decisions, open loops |
| `scripts/validate-spec.mjs` | Local and CI validation |
| `.github/workflows/` | CI pipelines |

---

## 11. Human judgment layer

Implementations **MUST** provide:

- **Checkpoints** bound to workflow steps.  
- **Confidence thresholds** per step class; sub-threshold behavior **MUST** escalate or fall back safely.  
- **Audit records**: approver identity, timestamp, evidence pointers.  
- **Rollback/compensation** where customer or financial impact exists.

Renaming a step **MUST NOT** bypass a checkpoint.

---

## 12. Operating loop (runtime procedure)

For each significant initiative:

1. Instantiate or select goal from spec.  
2. Decompose into tasks with explicit dependencies.  
3. Bind **Workflow Library** templates and **skills**.  
4. Execute; emit events and metrics.  
5. Collect evidence (artifacts, URLs, eval results).  
6. Run automated checks; route to human judgment per §11.  
7. Merge learnings into specs (assumptions ↔ facts).

---

## 13. Quality gates

Before closing a slice or workflow tranche, agents **MUST**:

- Preserve or strengthen validation (schema, automated tests where applicable).  
- Ensure new external behavior is **observable** per spec.  
- For AI-mediated user impact, maintain an **eval** artifact appropriate to risk (goldens, regressions, or defined human spot-check protocol).

The normative operating procedure for verification layers, merge-gate model, CI structure, maturity phases, and incident-to-regression discipline is **[`docs/QUALITY_STANDARD.md`](QUALITY_STANDARD.md)**. This section states the invariant; that document states how to execute it.

---

## 14. Governance and ethics

- **MUST NOT** represent the system as fully autonomous in marketing or internal policy.  
- **MUST** preserve **human override** for governed actions.  
- **MUST** keep secrets out of specs; reference secret **names** only.  
- High-impact changes **SHOULD** follow **agent-propose → human-approve** with decision-log entry.

---

## 15. Automation maturity phases

1. Manual work with AI assistance.  
2. Scripts, templates, coding agents on bounded tasks.  
3. Stateful multi-step orchestration with measurement.  
4. Broad ops automation (product, growth, ops) **under** judgment policy.

Advancing phases **REQUIRES** stronger policy and measurement—not only more automation.

---

## 16. North-star outputs

From inputs (market or idea space, constraints, goals), a mature implementation **SHOULD** reliably produce:

- Ranked opportunities with explicit assumptions.  
- Recommended product shape and MVP plan.  
- Launch strategy and scoped assets.  
- Execution roadmap.  
- Ongoing prioritized recommendations tied to feedback loops.

Output quality depends on **spec fidelity, data, evals, and governance**—not on any single model provider.

---

## 17. Anti-patterns (MUST avoid)

- Spec prose without validated artifacts.  
- Ungoverned event proliferation.  
- Renaming agents without changing capabilities or tools.  
- Irreversible external effects without checkpoint records.  
- Embedding vendor-specific assumptions in core business rules.

---

## 18. Closing principle

The framework’s value is the **encoding** of how companies are built, operated, and improved into a **reusable, learning, auditable system**—with agents executing structured work under **machine-verifiable** rules and **human judgment** where it belongs.

---

*End of framework v0.1.*
