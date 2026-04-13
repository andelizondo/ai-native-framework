# Playbook: Quality Standard Execution

**Version:** 0.1  
**Normative reference:** `docs/QUALITY_STANDARD.md`  
**Authority:** Procedure playbook — sits below schema and policy, above `docs/` prose.

---

## Objective

Carry out the verification discipline defined in the Quality Standard across three recurring operational loops:

1. **PR gate loop** — confirm all blocking gates are green before merge
2. **Nightly triage loop** — review nightly CI failures before the next release
3. **Incident-to-regression loop** — close every medium/high severity incident with a regression test

---

## Inputs

| Input | Required for |
|-------|-------------|
| Current phase of the product (`docs/QUALITY_STANDARD.md §8`) | Gate model |
| PR head SHA and current check states | PR gate loop |
| Nightly CI run URL and failure summary | Nightly triage loop |
| Incident ID and reproduction steps | Incident-to-regression loop |
| Vitest config and test directory location | All loops |
| Playwright config and BASE_URL | PR gate + nightly loops |

---

## Outputs

| Output | Loop |
|--------|------|
| All blocking gates green; PR mergeable | PR gate loop |
| Nightly issue opened (if failure); triaged and closed or escalated | Nightly triage |
| Regression test merged; incident closed | Incident-to-regression |

---

## 1. PR Gate Loop

### 1.1 Before opening a PR

1. Confirm a spec entry exists for any new behavior (`npm run validate`).
2. Write tests at the correct layer (unit → component → integration → E2E) before or alongside the feature code.
3. Run `npm test` locally and confirm it is green.

### 1.2 After opening a PR

1. **Wait for `validate` check.** Must pass. If it fails: fix the spec/schema issue before anything else.
2. **Wait for `test` check.** Must pass. If it fails:
   - Read the failure output. Identify which test and which assertion failed.
   - Fix the code or the test (prefer fixing the code unless the test expectation was wrong).
   - Do not skip or mark the failing test as `todo` to unblock.
3. **Wait for Vercel preview deployment.** The `e2e` check is triggered by `deployment_status`. If the Vercel deployment never triggers:
   - Confirm Vercel is connected to the repository and preview deployments are enabled.
   - If unavailable, escalate to the human operator — do not skip the E2E gate.
4. **Wait for `e2e` check.** Must pass. If it fails:
   - Download the Playwright HTML report artifact from the workflow run.
   - Identify the failing spec and the specific assertion (navigation? accessibility? smoke?).
   - Fix the underlying issue. Accessibility violations on critical flows block merge — they are not deferrable.
5. **Wait for `CodeRabbit` and `decide` checks** per `ai/playbooks/pull-request-execution-loop.md`.
6. Confirm all five gates are green: `validate`, `test`, `e2e`, `CodeRabbit`, `decide`.

### 1.3 Gate failure diagnosis order

```
1. Spec/schema failure → fix spec first, all else depends on it
2. Unit/component failure → isolate the failing assertion; fix code or test
3. Integration failure → check MSW handler coverage; confirm mock matches real API contract
4. E2E failure → check the Playwright trace; distinguish app bug from flaky selector
5. Accessibility failure → run axe locally with the same page; fix the violation in the component
6. Smoke failure → the deployment itself is broken; treat as P1
```

### 1.4 Adding new tests for the current change

- New API route → add integration test in `__tests__/api/`
- New client component → add component test in `__tests__/components/`
- New utility function → add unit test in `__tests__/lib/`
- New user-visible flow → add E2E scenario to `e2e/critical-paths.spec.ts` if it is a critical path, or defer to nightly suite if not
- New accessibility requirement → add axe assertion to the relevant spec in `e2e/critical-paths.spec.ts`

---

## 2. Nightly Triage Loop

Triggered when the `nightly` CI workflow reports a failure. A GitHub issue is auto-opened with label `nightly-failure`.

### 2.1 Triage procedure

1. Open the nightly workflow run URL in the issue.
2. Identify which job(s) failed: `test-full` or `e2e-full`.
3. **Classify the failure:**

   | Classification | Signal | Action |
   |---------------|--------|--------|
   | Product regression | A test that was green on `main` yesterday is now failing | Create fix PR with regression test before next release |
   | Flaky test | Intermittent failure with no code change | Add retry annotation or stabilize the selector; track in a follow-up |
   | Test environment issue | Network timeout, missing env var, infra hiccup | Fix test infrastructure; do not close issue until nightly is green two nights in a row |
   | External dependency change | Third-party API changed behavior | Update MSW handler or test expectation; document in decision log |

4. Assign a severity and deadline:
   - Product regression → P2 minimum; fix before next release (within 48h for P2).
   - Environment issue → fix within one business day.
   - Flaky test → fix within one sprint; do not let accumulate.

5. Close the nightly issue only when the nightly run is green for at least one subsequent run after the fix is merged.

### 2.2 Escalation

Escalate to human operator if:
- The regression touches AI-mediated behavior and requires an eval rerun.
- The root cause cannot be determined from CI logs and local reproduction.
- Two consecutive nights fail with different failures (suggests systemic instability).

---

## 3. Incident-to-Regression Loop

Triggered when a production incident of severity P1 or P2 is opened.

### 3.1 Protocol

1. **Reproduce locally.** Identify the minimal input that triggers the failure.

2. **Write a failing test first.** Choose the lowest applicable layer:

   ```
   Is it a pure logic bug? → unit test in __tests__/lib/
   Is it a component rendering bug? → component test in __tests__/components/
   Is it an API contract bug? → integration test in __tests__/api/
   Is it a user-visible flow bug? → E2E test in e2e/
   ```

   The test MUST fail on the current code before the fix is applied. Commit it as a failing test or write it as part of the fix PR with a comment showing it would have failed.

3. **Apply the fix.** Confirm the new test now passes.

4. **Tag the test with the incident ID:**

   ```typescript
   // Regression for incident #<ID>: <brief description>
   it("handles <condition> without <bad outcome>", ...)
   ```

5. **Run the full local suite.** Confirm green before opening a PR.

6. **Open a PR** with title pattern: `fix: <description> (regression for #<incident-id>)`.

7. **Confirm all gates pass** using the PR gate loop (§1).

8. **After merge:** re-run the nightly suite manually via `workflow_dispatch` to confirm the fix is green in the full nightly context.

9. **Close the incident** with a reference to the merged PR and the test file/line.

### 3.2 AI-specific incidents

If the incident involves AI-mediated behavior:

1. Add the incident input/output pair to the golden dataset under `products/dashboard/evals/<feature>/golden.json`.
2. Re-run the eval suite to confirm the new negative example is caught.
3. Promote the updated dataset and eval results as part of the fix PR.
4. Human must review and sign off on dataset changes before merge (Phase 2 requirement).

---

## 4. Phase Advancement Gate

Before declaring a product ready for Phase 2 or Phase 3, run through the relevant checklist from `docs/QUALITY_STANDARD.md §8`.

1. For each checklist item: confirm it is true by reading the actual code/config, not just by recall.
2. Items that are not yet complete must be tracked as open issues before phase advancement.
3. Phase advancement is a human decision — present the evidence, do not self-advance.

---

## Escalation Conditions

Stop and escalate to the human operator when:

- A blocking gate failure cannot be attributed to the current change.
- An accessibility violation on a critical flow cannot be fixed within the current PR scope.
- The production smoke check fails after release.
- The nightly suite fails for two consecutive nights with different root causes.
- AI eval results drop below threshold and the cause is ambiguous.
- Phase advancement requires a governance decision.

---

## Canonical References

- `docs/QUALITY_STANDARD.md` — normative standard (verification layers, gate model, phase criteria)
- `products/dashboard/vitest.config.ts` — Vitest configuration
- `products/dashboard/playwright.config.ts` — Playwright configuration
- `products/dashboard/__tests__/` — unit and component test suite
- `products/dashboard/e2e/` — E2E and accessibility suite
- `.github/workflows/test.yml` — Vitest CI workflow
- `.github/workflows/e2e.yml` — Playwright CI workflow (deployment_status)
- `.github/workflows/nightly.yml` — nightly confidence suite
- `ai/playbooks/pull-request-execution-loop.md` — PR review and merge policy
