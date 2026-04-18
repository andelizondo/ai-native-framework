# Quality Standard

**Version:** 0.1 (initial)  
**Scope:** This repository and all downstream framework-aligned products. `products/dashboard` is the canonical reference implementation.  
**Authority:** Normative for verification, test, and reliability decisions. See `docs/AI_NATIVE_FRAMEWORK.md` §13 and `spec/policy/` for the higher-order rules this standard operationalizes.

---

## 1. Purpose and scope

This standard defines the **verification system** for framework-aligned products: what to verify, how to verify it, when verification is a blocking merge gate vs. a background confidence signal, and how to evolve the system as a product matures.

It applies to:

- All features and slices shipped in golden products (starting with `products/dashboard`).
- AI-mediated behavior that materially affects user-visible outcomes.
- Any product that declares conformance with the AI-Native Framework.

It does **not** replace:

- `docs/ANALYTICS_STANDARD.md` — event capture, PII discipline, and error monitoring remain a separate governed concern (cross-referenced in §14).
- `spec/policy/event-taxonomy.yaml` — event naming and payload rules.
- `ai/playbooks/` — PR execution loop, repository foundation, and release management procedures.

---

## 2. Relationship to Analytics Standard and observability

The **Analytics Standard** governs behavioral instrumentation: what events to capture, how to name them, PII rules, and the PostHog/Sentry wiring. This standard governs **verification**: how to confirm the system does what the spec says it does.

The two surfaces interlock:

- Observability signals (Sentry errors, PostHog funnels, health endpoints) are inputs to the **production verification loop** in this standard (§12).
- An incident detected through observability feeds back into the regression-test discipline in this standard (§13).
- Evals for AI-mediated features use structured events from the analytics pipeline as ground truth where applicable.

Neither standard replaces the other. Keep them as separate governed surfaces.

---

## 3. Core principles

| Principle | Normative requirement |
|-----------|----------------------|
| **Spec-first verification** | Tests **MUST** trace back to a named behavior in the product spec. Tests without a spec anchor are unverifiable as correct. |
| **Lean PR gates** | Pull request CI **MUST** stay fast. Only critical-path checks are blocking on every PR. Heavier suites run nightly or on release flows. |
| **Observable by default** | Every production environment **MUST** have active error monitoring and behavioral analytics before a feature is considered shipped. |
| **AI is a first-class testable subsystem** | AI-mediated behavior affecting user-visible outcomes **MUST** be evaluated with the same discipline as deterministic behavior, not informally. |
| **Incident → regression** | Every production incident of medium severity or above **MUST** produce a regression test before the incident is closed. |
| **Agent-executable** | This standard is written so agents can follow it operationally without human interpretation at each step. Blocking/non-blocking distinctions, tool choices, and escalation conditions are explicit. |
| **Provider-agnostic** | No single LLM vendor is encoded as the required AI evaluation target. The standard defines evaluation structure, not model identity. |

---

## 4. Default stack and rationale

These are the blessed defaults for the golden product (`products/dashboard`). Downstream repos **MAY** substitute equivalents behind the same abstraction boundaries, but deviations **SHOULD** be recorded in the decision log.

| Concern | Default tool | Rationale |
|---------|-------------|-----------|
| Unit and component tests | **Vitest** | Fast, ESM-native, works in the same Jest-compatible syntax without the config overhead |
| Component rendering | **React Testing Library** | Tests behavior and accessibility semantics, not implementation details |
| API mocking | **MSW (Mock Service Worker)** | Intercepts at the network layer; works in both browser and Node test environments; no brittle manual mocks |
| End-to-end / browser | **Playwright** | Cross-browser, fast, first-class TypeScript, supports network interception and accessibility assertions |
| Error monitoring | **Sentry** | See `docs/ANALYTICS_STANDARD.md §9`; already required; Sentry is the source of truth for production error rates |
| Product analytics | **PostHog** | See `docs/ANALYTICS_STANDARD.md`; funnel and retention data drives the production verification loop |
| Preview environments | **Vercel preview deployments** | Per-PR preview URLs enable smoke verification before merge and release |
| Deployment environments | **Three tiers: production / staging / development** | `main` → production (real users only); `staging` branch → stable Vercel preview alias used by nightly CI and PR E2E; local → development. PostHog is only initialised in the production Vercel environment; automated test traffic never reaches production metrics. |
| Coverage aggregation | **Codecov** (optional) | LCOV from Vitest uploads on PR/main for trends and patch comments; configured as a non-blocking signal via `codecov.yml` unless the team tightens thresholds in Codecov |

**AI evals** do not have a single default tool. Use a structured eval runner (custom scripts, LangSmith, or equivalent) that:

- accepts a golden dataset
- runs structured prompts against the current model configuration
- records pass/fail and scores per assertion
- stores results as versioned artifacts alongside the spec

The eval runner **MUST** be replaceable without rewriting eval logic.

---

## 5. Verification layers

Each layer has a defined scope, default tooling, when it runs, and its merge-gate status. These layers are cumulative: higher phases add layers; they do not replace lower ones.

### 5.1 Spec and schema validation

**What:** JSON Schema validation of product and slice YAML against `spec/schema/`.  
**Tool:** `npm run validate` (AJV-based, already canonical).  
**When:** Every PR (fast, deterministic).  
**Gate status: BLOCKING.**  
**Notes:** A spec must be updated before or alongside any behavior change. See `docs/AI_NATIVE_FRAMEWORK.md §9`.

### 5.2 Unit tests

**What:** Pure functions, data transformations, utility logic, non-UI business rules.  
**Tool:** Vitest.  
**When:** Every PR.  
**Gate status: BLOCKING.**  
**Notes:** Keep unit tests fast (< 5s total suite). If a unit test takes more than 200ms, it belongs in a higher layer.

### 5.3 Component tests

**What:** Individual React components rendered in isolation. Verifies rendering, interaction, and accessibility semantics at the component boundary.  
**Tool:** Vitest + React Testing Library.  
**When:** Every PR.  
**Gate status: BLOCKING.**  
**Notes:** Use `getByRole`, `getByLabelText`, and similar accessible queries by default. Querying by test ID is acceptable only when semantic role is ambiguous. MSW handles any API calls the component makes.

### 5.4 Integration tests

**What:** Multi-component flows wired through real or MSW-mocked API boundaries. Covers server actions, route handlers, and cross-component state.  
**Tool:** Vitest + MSW.  
**When:** Every PR (fast subset); nightly (full set).  
**Gate status:** PR fast-subset is **BLOCKING**. Nightly full set is **non-blocking on PR** but failures must be triaged within one business day.  
**Notes:** Separate the fast subset (< 30s) from the full suite. Fast subset covers critical paths; full suite adds edge cases, error states, and data boundary conditions.

### 5.5 End-to-end tests

**What:** Full browser flows against a real deployment. Covers authentication, navigation, data round-trips, and observable user outcomes.  
**Tool:** Playwright.  
**When:** Critical-path subset runs on every PR (against Vercel preview); full E2E suite runs nightly and on release.  
**Gate status:** Critical-path E2E subset is **BLOCKING on PR** (requires Vercel preview URL to be available). Full suite is **non-blocking on PR**.  
**Notes:** The critical-path E2E suite should cover fewer than 10 scenarios—only the paths where failure is immediately user-visible and non-recoverable. Keep the PR suite under 5 minutes. When an external auth provider makes deterministic authenticated browser setup impractical on preview environments, a product MAY use a dedicated **test-only authenticated-session bypass** for E2E. That bypass must be explicitly gated by a secret, unavailable in normal runtime behavior, and used only to reach the post-authenticated state for browser verification; it must not replace coverage of the public login and callback error paths.

### 5.6 Accessibility checks

**What:** Automated WCAG 2.1 AA scan of rendered pages and interactive flows.  
**Tool:** Playwright + `@axe-core/playwright` (or equivalent Playwright accessibility assertions).  
**When:** Every PR (critical flows); full accessibility audit in nightly/release runs.  
**Gate status: BLOCKING for critical flows on PR.** Non-critical flows are **non-blocking on PR** but are tracked as tech debt.  
**Notes:** Critical flows are defined as: sign-in/sign-up, primary navigation, any form that captures user data, and the main product surface. Violations on these flows block merge. New violations on non-critical flows require a tracked follow-up issue within 24 hours.

### 5.7 Visual regression

**What:** Screenshot comparison of key UI surfaces to detect unintended layout or style changes.  
**Tool:** Playwright screenshot assertions or equivalent (e.g., Argos CI, Percy).  
**When:** Scoped to critical UI surfaces, running on release-oriented flows (not every PR).  
**Gate status: NON-BLOCKING on PR. BLOCKING on release cut** for any component in the visual test set.  
**Notes:** Visual regression is **selective and intentional**, not a universal gate from day one. Expand coverage incrementally. Do not add visual tests for components that change frequently by design (e.g. loading skeletons).

### 5.8 AI evals (when applicable — mandatory under Phase 2)

**What:** Structured evaluation of AI-mediated behavior against a golden dataset. Verifies that outputs meet defined acceptance thresholds.  
**Tool:** Eval runner with structured dataset (see §4 notes on AI eval tooling).  
**When:** On PR (threshold check against golden set); nightly (full regression suite); required before any release that changes a model configuration, prompt template, or AI-mediated user flow.  
**Gate status (Phase 2+):** Threshold check on golden set is **BLOCKING on PR**. Full regression is **non-blocking on PR**. Any regression below the threshold triggers a required human review before merge.  
**Notes:** See §9.2 for the full eval protocol.

### 5.9 Release and preview smoke verification

**What:** Post-deployment health check against a Vercel preview (pre-merge) or production (post-release).  
**Tool:** Playwright smoke suite + health endpoint check.  
**When:** After every deployment. On PR: after Vercel preview is ready. On release: after production deploy.  
**Gate status:** Preview smoke is **BLOCKING on PR merge** (the preview must exist and core health checks must pass). Production smoke result feeds the production feedback loop (§12) but does not roll back automatically without human decision.  
**Notes:** Smoke verification is distinct from the full E2E suite. It covers app boot, auth, and one load of the primary surface—enough to confirm the deployment is not broken.

### 5.10 Authentication-specific verification rules

For products with authentication as a canonical slice:

- the public sign-in route is part of the critical accessibility surface
- protected-route redirect behavior is part of the PR E2E critical path
- sign-in identity lifecycle must be covered at the unit/integration layer: analytics identity set on sign-in, reset on sign-out, monitoring user context updated in lockstep
- provider-specific auth logic should be tested behind a repo-owned auth service boundary; pages, layouts, and middleware should be verified against the service contract, not the provider SDK directly

---

## 6. Merge-gate model

This section summarizes what blocks merge on every pull request and what does not.

### 6.1 Blocking gates (every PR)

All of the following **MUST** pass before any PR merges:

1. `npm run validate` (spec and schema validation)
2. Unit tests (Vitest)
3. Component tests (Vitest + RTL)
4. Integration fast-subset (Vitest + MSW)
5. Critical-path E2E (Playwright on Vercel preview)
6. Critical-flow accessibility scan
7. Preview smoke verification
8. AI eval threshold check on golden set *(Phase 2+ only; skip in Phase 1)*

In this repository, these conceptual gates map to the required CI checks as follows: `validate` enforces item 1; `test` aggregates items 2-4; `e2e` aggregates items 5-7 on the Vercel preview; and a future `ai-eval` check would enforce item 8 starting in Phase 2.

### 6.2 Non-blocking checks (run on PR, failures tracked but do not block)

- Codecov coverage upload and PR comments (LCOV from `products/dashboard` Vitest; project/patch status is **informational** in `codecov.yml` unless changed in Codecov settings)
- Full integration suite (runs async or in a parallel non-required job)
- Full E2E suite
- Non-critical accessibility scan
- Visual regression on PR *(blocking only on release cut)*
- Auth-provider-specific deep browser flows that require external inboxes or third-party consoles, if the product already has a guarded deterministic bypass for the authenticated state and the public login surface remains covered in the blocking suite

### 6.3 Nightly / release-only checks

These run outside the PR loop and are not configured as required status checks:

- Full E2E suite (nightly)
- Full accessibility audit (nightly)
- Visual regression baseline comparison (nightly + release)
- AI eval full regression suite (nightly + on model config changes)
- Production smoke verification (post-release)

### 6.4 Human escalation triggers

An agent **MUST** escalate to a human before merging when:

- Any blocking gate has a failure that cannot be attributed to the current change.
- An AI eval regression drops below the defined threshold and the cause is ambiguous.
- A production smoke failure occurs after release.
- A visual regression affects a governed UI surface and the cause is a product change, not a test artifact.

---

## 7. CI execution model

### 7.1 PR CI structure

PR CI is intentionally lean. The target total wall-clock time is under 10 minutes.

```text
PR opened / updated
  └─ validate            (spec schema — fast, required)
  └─ test:unit           (Vitest — fast, required)
  └─ test:components     (Vitest + RTL — fast, required)
  └─ test:integration    (Vitest + MSW fast subset — required)
  └─ test:e2e:critical   (Playwright on preview URL — required, waits for preview)
  └─ test:a11y:critical  (axe on preview URL — required)
  └─ smoke               (health + boot check on preview — required)
  └─ test:integration:full  (full suite — non-required, runs in parallel)
```

Blocking checks are configured as required status checks on the protected branch. Non-blocking checks run as companion jobs that surface failures in the PR without blocking merge.

### 7.2 Nightly CI structure

Nightly jobs run on a schedule (e.g. `0 3 * * *`) against the `staging` environment (`staging.ai-native-framework.app`). Production is never a nightly target; automated traffic must not pollute production analytics or error-rate baselines.

```text
nightly
  └─ test:e2e:full       (full Playwright suite against staging)
  └─ test:a11y:full      (full accessibility audit against staging)
  └─ test:visual         (visual regression comparison)
  └─ eval:ai:full        (full AI eval suite — Phase 2+)
  └─ smoke:staging       (staging environment health check)
```

Failures in nightly jobs open a tracking issue automatically (or post to an alert channel) and are triaged before the next release cut.

### 7.3 Release CI structure

On release cut or release PR, run:

```text
release
  └─ all PR CI checks
  └─ test:e2e:full
  └─ test:a11y:full
  └─ test:visual         (BLOCKING for release)
  └─ eval:ai:full        (BLOCKING if model config changed — Phase 2+)
  └─ smoke:production    (post-deploy, informing rollback decision)
```

---

## 8. Maturity phases

### Phase 1 — Tooling Foundation for Full Product Reliability

**When to apply:** Default starting point for any new product in the framework. A product is in Phase 1 until Phase 2 criteria are met.

**Goal:** Establish the full verification stack with lean PR gates, observable releases, and no known regressions shipping silently.

**Required for Phase 1 completion:**

- [ ] `npm run validate` runs and is a required status check.
- [ ] Vitest configured; unit and component tests exist for all non-trivial logic.
- [ ] MSW configured; API boundaries mocked in tests.
- [ ] Playwright configured; critical-path E2E suite exists (≥ 1 flow per primary user path).
- [ ] Critical-flow accessibility check runs on every PR and is a required status check.
- [ ] Vercel preview deployments are active and the preview URL is available to CI.
- [ ] Preview smoke verification runs on every PR and is a required status check.
- [ ] Sentry is active in production and the error rate is observable.
- [ ] PostHog is active and primary funnels are defined.
- [ ] Nightly job exists (even if thin); failures create a tracking issue.
- [ ] Incident-to-regression discipline is active (§13).

**Merge-gate model in Phase 1:** Follow §6 with AI eval gate skipped.

**Non-goals for Phase 1:** Visual regression baseline, full E2E suite as blocking, AI evals.

---

### Phase 2 — AI Reliability

**When to apply:** When any AI-mediated feature materially affects user-visible outcomes. This phase is **not optional** once that condition is met.

Materiality test: if a user can observe a different outcome depending on which model, prompt, or configuration is in use, AI Reliability applies.

**Goal:** Make AI behavior as verifiable as deterministic behavior. Add structured evals, golden datasets, and regression thresholds to the governed verification surface.

**Required additions for Phase 2:**

- [ ] An eval runner is configured and can be invoked from CI.
- [ ] A golden dataset exists for each AI-mediated feature (minimum 20 representative inputs, expected outputs, and pass/fail criteria).
- [ ] A pass-rate threshold is defined per feature (e.g. ≥ 95% on golden set).
- [ ] Eval threshold check runs on every PR that touches an AI-mediated flow (blocking).
- [ ] Full eval regression suite runs nightly.
- [ ] Eval artifacts are stored as versioned files, not ephemeral CI output.
- [ ] Human spot-check protocol is defined: any eval result that drops below threshold must be reviewed by a human before merge.
- [ ] Model configuration changes (model ID, prompt templates, system prompts) require a full eval run before merge, not just a threshold check.
- [ ] AI-specific anti-patterns are covered in the regression set (hallucinations, format violations, refusals, boundary cases).

**Provider-agnostic requirement:** The eval dataset and scoring logic **MUST NOT** assume a specific vendor. The eval runner accepts a model configuration as a parameter. Switching vendors requires re-running evals, not rewriting them.

**Human judgment points in Phase 2:**

- Any PR that degrades the eval pass rate, even if still above threshold: agent flags and requests human decision before merge.
- Any change to a golden dataset: requires human review and sign-off before the dataset is promoted.
- New AI-mediated feature: human must define the threshold and sign off on the initial golden set.

---

### Phase 3 — Scaling Confidence

**When to apply:** When the product has multiple AI-mediated features, significant user traffic, or cross-browser and cross-device user requirements. Adopt incrementally as these conditions arise.

**Goal:** Expand the verification surface so that confidence scales with product complexity without degrading PR CI speed.

**Required additions for Phase 3:**

- [ ] Visual regression baseline established for the primary product surfaces. Blocking on release cut.
- [ ] Cross-browser E2E coverage added for critical paths (Chromium + at least one other engine via Playwright).
- [ ] Full E2E suite runs nightly and failures are triaged before the next release.
- [ ] Production verification loop is active: Sentry error rates and PostHog funnel conversion feed back into the spec and test suite on a defined cadence (§12).
- [ ] Performance budget defined (e.g. Core Web Vitals thresholds) and monitored.
- [ ] Contract testing adopted for APIs consumed by third parties or consumed by more than one product, if applicable.
- [ ] Incident-to-regression loop closes within 48 hours for P1 incidents and within one sprint for P2.
- [ ] Eval golden datasets are reviewed on a defined cadence (quarterly or after any model config change).

**Lean CI preserved:** Phase 3 does not add blocking gates to PR CI beyond Phase 2. All additions are nightly, release-only, or non-blocking companion jobs.

**Human judgment points in Phase 3:**

- Visual regression failures on governed surfaces: agent flags, human approves or rejects the visual change.
- Performance budget violations: human decides whether to treat as blocking or track as debt.
- Contract schema changes: human sign-off required before promotion.

---

## 9. Dashboard reference implementation

`products/dashboard` is the canonical reference implementation of this standard. It demonstrates every required element of the phase in which it currently operates and serves as the template other products adopt.

### 9.1 Current expectations (Phase 1)

The dashboard product **MUST**:

- Pass `npm run validate` on every PR (spec/schema gate).
- Run Vitest unit and component tests as required CI checks.
- Run a Playwright critical-path E2E suite on every PR against the Vercel preview URL.
- Run a critical-flow accessibility scan as a required CI check.
- Run preview smoke verification as a required CI check.
- Have Sentry active with error rate observable.
- Have PostHog active with primary user flows tracked per `docs/ANALYTICS_STANDARD.md`.

When these are fully in place, the dashboard product satisfies Phase 1.

### 9.2 AI eval protocol (Phase 2, when applicable)

When an AI-mediated feature is added to the dashboard:

1. Add a golden dataset under `products/dashboard/evals/<feature-slug>/golden.json` (or `.yaml`).  
   Dataset shape: `[{ input, expected, metadata }]`.
2. Define thresholds in `products/dashboard/evals/<feature-slug>/config.json`.
3. Wire the eval runner as a CI job: `eval:<feature-slug>`.
4. Eval job is **required** on any PR touching `<feature-slug>` code or config.
5. Eval artifacts (results, diffs vs. previous run) are committed or uploaded as CI artifacts.
6. Human sign-off required on: initial dataset creation, threshold changes, golden dataset promotion after drift review.

---

## 10. Agent responsibilities

Agents executing work in this repository or in a framework-aligned downstream product **MUST**:

1. **Before implementing a feature:** confirm a spec entry and event catalog entry exist (or create them per `docs/AI_NATIVE_FRAMEWORK.md §9` and the feature implementation playbook). Verification without a spec anchor is invalid.

2. **When writing code:** add corresponding tests at the appropriate layer (unit for logic, component for rendering, integration or E2E for user flows).

3. **When opening a PR:** confirm all blocking gates are green before requesting merge. Do not merge with failing required checks.

4. **When a blocking gate fails:** diagnose the failure before switching tactics. Do not skip gates, bypass hooks, or treat CI configuration changes as a default fix path.

5. **When a non-blocking check fails:** create a tracking issue or task before closing the PR. Do not treat non-blocking as "doesn't matter."

6. **When an AI eval degrades:** flag to the human operator with the diff before merge, even if still above threshold. Do not merge an AI change that worsens eval scores without human acknowledgment.

7. **When an incident occurs:** follow the incident-to-regression loop (§13) before closing the incident.

8. **When advancing maturity phase:** confirm phase completion criteria are met. Do not self-promote a product's phase without checking off the required list.

---

## 11. Human judgment and escalation points

Agents **MUST** escalate to a human when any of the following is true:

| Condition | Action |
|-----------|--------|
| A blocking gate fails with a cause that cannot be attributed to the current change | Stop, report, wait for human decision |
| An AI eval drops below threshold on a PR | Block merge, present eval diff, require human sign-off |
| A golden dataset needs to be promoted or modified | Human review and sign-off required |
| A production smoke check fails after release | Notify human operator; do not auto-rollback without instruction |
| A visual regression affects a governed surface | Present screenshot diff, require human decision |
| A performance budget is violated in production | Flag as a release-blocking issue; human decides severity |
| A new AI-mediated feature is being added | Human must define eval threshold and initial golden set |
| Phase advancement is proposed | Human must confirm phase readiness before phase label changes |

These are not optional escalation points. The framework's 90/10 automation-to-human leverage model requires that the 10% is real, not bypassed.

---

## 12. Production feedback loop

Production is a verification layer. The feedback loop closes the gap between "tests pass" and "users succeed."

### 12.1 Signal sources

| Source | Signal | Cadence |
|--------|--------|---------|
| Sentry | Error rate, new issues, regression errors | Real-time alerting |
| PostHog | Funnel conversion, feature adoption, session anomalies | Weekly review |
| Vercel preview smoke | Pre-merge health | Every PR |
| Production smoke | Post-release health | Every release |
| User reports / support | Qualitative anomalies | As received |

### 12.2 Feedback cadence

- **After every release:** run production smoke verification. If Sentry baseline shifts above threshold, open a P1 issue before the next release.
- **Weekly:** review PostHog funnel data against expected conversion rates from the spec. Update the spec's `assumptions` → `facts` when data confirms or refutes a hypothesis.
- **After nightly CI failures:** triage within one business day. If a nightly failure exposes a user-facing regression, treat as a production issue.

### 12.3 Feedback outputs

- Sentry errors with no corresponding test coverage → add a unit, component, or integration test.
- PostHog funnel drop at a specific step → investigate and either fix the UX, add a test, or update the spec assumption.
- Production anomaly not caught by existing tests → add to the regression test suite before closing.

---

## 13. Incident-to-regression discipline

**Rule:** Every production incident of severity P1 or P2 **MUST** produce a regression test before the incident is marked resolved.

### 13.1 Protocol

1. **Reproduce in test:** Write a failing test that reproduces the incident condition at the lowest applicable layer (unit > component > integration > E2E). The test must fail on the incident-era code.
2. **Fix:** Apply the fix. The test now passes.
3. **Promote:** The new test becomes part of the permanent test suite. It is not marked as `skip` or `todo`.
4. **Link:** The test includes a comment or tag linking it to the incident ID or issue number.
5. **Verify:** Run the full suite including the new test in CI. Confirm green before closing the incident.

### 13.2 Timelines

| Severity | Regression test deadline |
|----------|--------------------------|
| P1 (complete outage or data loss) | Before incident closure |
| P2 (significant user-facing degradation) | Within 48 hours |
| P3 (minor UX or non-critical flow) | Within one sprint |

### 13.3 AI-specific incidents

If the incident involves AI-mediated behavior:

- Add the incident input/output pair to the golden dataset as a negative example.
- Re-run the eval suite after the fix to confirm the new case passes.
- Promote the updated dataset before closing the incident.

---

## 14. Anti-patterns

Agents and operators **MUST NOT** adopt these practices:

| Anti-pattern | Why it fails |
|-------------|-------------|
| Tests that pass without a spec anchor | Unverifiable as correct; masks spec drift |
| Skipping accessibility checks "just for this PR" | Accessibility debt accumulates silently and becomes expensive to fix |
| AI evals as ad-hoc scripts, not governed artifacts | Breaks the feedback loop; results become non-reproducible |
| Merging with non-blocking failures untracked | Non-blocking does not mean unimportant; failures become permanent background noise |
| Adding visual regression to every component from day one | Generates false positives on design-intended changes; degrades trust in the gate |
| Using `--no-verify` or temporarily removing required checks to unblock a PR | Bypasses the governance model; acceptable only with a visible human waiver |
| Treating nightly failures as irrelevant because they're non-blocking | Nightly is the early warning system; ignoring it guarantees surprises at release |
| Configuring a single model vendor as the required eval target | Locks the framework to a vendor; violates provider-agnostic principle |
| Closing incidents without regression tests | Ensures the same bug recurs and is shipped again |
| Blurring observability (Analytics Standard) and verification (this standard) | Creates competing authorities; PII rules and event-catalog discipline live in the Analytics Standard |

---

## 15. Phased rollout guidance for downstream repos

Framework-aligned repositories adopting this standard **SHOULD** follow this sequence:

### Step 1 — Baseline assessment (before any new tests)

Read the current state: What CI jobs exist? What is required? What is passing?
Do not add new tests before understanding what already passes or fails.

### Step 2 — Introduce the stack (Phase 1 tooling)

Add Vitest, RTL, and MSW. Write tests for one vertical slice end-to-end before writing tests for the whole surface. Confirm CI integration before expanding.

### Step 3 — Add Playwright and preview CI

Configure Playwright against your staging or preview URL. Start with one critical-path flow. Confirm the E2E job runs on PRs and the preview URL is reliably available before adding more tests.

### Step 4 — Wire accessibility

Add `@axe-core/playwright` to the Playwright suite. Run on critical flows first. Fix blocking violations before making the check required.

### Step 5 — Make Phase 1 gates required

Once the suite is green on `main`, promote the fast subset to required status checks. Set nightly CI to run the full suite. Confirm Sentry and PostHog are active in production.

### Step 6 — Evaluate for Phase 2

When the first AI-mediated feature is added, follow §8 Phase 2 criteria. Do not wait until multiple AI features exist; start the eval infrastructure with the first feature.

### Step 7 — Expand to Phase 3 incrementally

Add visual regression, cross-browser, and production feedback loops as the product complexity and user traffic warrant. Never rush to Phase 3 to satisfy a checklist.

---

## 16. Open loops and future work

- `ai/playbooks/quality-standard-execution.md` is the canonical execution procedure for quality-gate operations (PR gate loop, nightly triage, incident-to-regression).
- `ai/skills/quality-engineer.md` is the canonical skill for recurring quality engineering workflows.
- A machine-readable `spec/processes/quality-standard-process.yaml` should formalize the phase criteria and blocking/non-blocking gate rules once process schemas are introduced.

See `ai/MEMORY.md` for the corresponding open loop entry.

---

*End of Quality Standard v0.1.*
