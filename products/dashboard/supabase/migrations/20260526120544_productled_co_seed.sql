-- ProductLed Co full company seed.
--
-- Wipes and reseeds the demo surface: skills + playbooks + their IO spine,
-- workflow templates, and ~22 example instances with realistic statuses,
-- produced artifacts, and an event feed. Replaces the legacy 4-template seed
-- from 20260419120100 and 20260503120100. Re-running this migration is a
-- safe wipe-and-reseed against the same row set.
--
-- Plan: ~/.claude/plans/i-want-that-the-lazy-matsumoto.md
-- Naming policy: industry-standard job titles (Product Manager, Software
-- Engineer, Customer Success Manager — not "Agent" suffixes). Playbook and
-- workflow names are the words real teams say out loud (Sprint Planning,
-- QBR, Discovery Interview, Postmortem). Instance labels carry a real
-- subject (Acme Robotics, Loomstack, Fernpath, ...) so the sidebar reads
-- like an operating company.
--
-- Single transaction; if any section fails the whole seed rolls back.

begin;

-- =============================================================================
-- Section 1: Wipe seeded surface (FK-safe order)
-- =============================================================================
delete from public.task_inputs;
delete from public.task_outputs;
delete from public.workflow_events;
delete from public.workflow_tasks;
delete from public.workflow_instances;
delete from public.playbook_inputs;
delete from public.playbook_outputs;
delete from public.workflow_templates;
delete from public.framework_item_allowed_skills;
delete from public.framework_items;

-- =============================================================================
-- Section 2: Skills (15 — industry-standard job titles, id = slug)
-- =============================================================================
insert into public.framework_items (id, type, name, description, icon, color, content) values
  ('product-manager','skill','Product Manager','Problem framing, scope, acceptance criteria, prioritization','📋','#6366f1',
    E'# Product Manager\n\n## What this skill owns\nShaping requests into testable scope. Prioritization. Acceptance criteria. Cross-functional alignment.\n\n## When to apply\n- New feature request needs a problem statement\n- Backlog grooming or sprint planning\n- Roadmap reviews\n\n## Quality bar\n- Every story has a clear user, goal, and success metric\n- Non-goals are explicit'),
  ('product-designer','skill','Product Designer','UX/UI, prototypes, design tokens, handoff','🎨','#ec4899',
    E'# Product Designer\n\n## What this skill owns\nUser flows, hi-fi visuals, prototypes, design system contributions, engineering handoff.\n\n## Quality bar\n- WCAG AA contrast\n- Tokens used for color/spacing/type\n- States: empty, loading, error, success'),
  ('user-researcher','skill','User Researcher','Discovery interviews, usability tests, synthesis','🔍','#8b5cf6',
    E'# User Researcher\n\n## What this skill owns\nDiscovery and evaluative research. Interview guides. Synthesis into actionable insights.\n\n## Quality bar\n- N ≥ 5 for qualitative themes\n- Verbatim quotes in synthesis'),
  ('software-engineer','skill','Software Engineer','Implementation, vertical slices, tests, PRs','⚡','#0ea5e9',
    E'# Software Engineer\n\n## What this skill owns\nVertical slices: UI + API + persistence + telemetry + tests. PR through merge.\n\n## Quality bar\n- Tests cover the happy path and one failure mode\n- All required CI checks green before merge'),
  ('qa-engineer','skill','QA Engineer','Test plans, regression suites, release gates','✅','#10b981',
    E'# QA Engineer\n\n## What this skill owns\nTest plans, regression coverage, release-readiness signoff, flake triage.\n\n## Quality bar\n- E2E covers the user-facing acceptance criteria\n- Suite is green for 3 consecutive runs before signoff'),
  ('site-reliability-engineer','skill','Site Reliability Engineer','Infra, deploys, observability, incident response','🔧','#f59e0b',
    E'# Site Reliability Engineer\n\n## What this skill owns\nInfrastructure, deploy pipeline, observability, on-call, incident response.\n\n## Quality bar\n- Every prod service has dashboards + alerts\n- Error budgets reviewed weekly'),
  ('engineering-manager','skill','Engineering Manager','Capacity, delivery, 1:1s, eng-ops','🧰','#64748b',
    E'# Engineering Manager\n\n## What this skill owns\nTeam capacity, delivery cadence, 1:1s, hiring loops, eng-ops decisions.\n\n## Quality bar\n- Sprint commitments tracked against actuals\n- Blockers escalated within 24h'),
  ('growth-marketer','skill','Growth Marketer','Demand gen, content, landing pages, lifecycle','📈','#22c55e',
    E'# Growth Marketer\n\n## What this skill owns\nTop-of-funnel demand, landing pages, content distribution, lifecycle automation.\n\n## Quality bar\n- Every campaign has a tracked conversion goal\n- Attribution model documented'),
  ('product-marketing-manager','skill','Product Marketing Manager','Positioning, messaging, launches, enablement','📣','#f97316',
    E'# Product Marketing Manager\n\n## What this skill owns\nPositioning, messaging architecture, launch plans, sales enablement.\n\n## Quality bar\n- Messaging house signed off before launch assets are built\n- Battle cards updated quarterly'),
  ('account-executive','skill','Account Executive','Discovery, demos, negotiation, close','🤝','#06b6d4',
    E'# Account Executive\n\n## What this skill owns\nQualification, discovery, tailored demos, proposals, negotiation, close.\n\n## Quality bar\n- MEDDPICC fields filled before forecast commit\n- Mutual close plan with every opportunity ≥ $50k ACV'),
  ('customer-success-manager','skill','Customer Success Manager','Onboarding, adoption, QBRs, renewals, expansion','🎧','#14b8a6',
    E'# Customer Success Manager\n\n## What this skill owns\nCustomer onboarding, adoption, health scoring, QBRs, renewals, expansion plays.\n\n## Quality bar\n- Every account has a current health score\n- Renewal risk reviewed 90 days out'),
  ('customer-support-engineer','skill','Customer Support Engineer','Triage, troubleshooting, knowledge base','🛟','#3b82f6',
    E'# Customer Support Engineer\n\n## What this skill owns\nTicket triage, troubleshooting, KB articles, escalation to engineering.\n\n## Quality bar\n- First response within SLA\n- Every P0/P1 closes with a KB article or fix PR'),
  ('finance-operations','skill','Finance Operations','Quotes, invoicing, ARR, runway','💰','#a855f7',
    E'# Finance Operations\n\n## What this skill owns\nQuotes, invoicing, AR, ARR tracking, runway model, board financials.\n\n## Quality bar\n- AR > 30 days flagged weekly\n- Monthly close within 5 business days'),
  ('people-operations','skill','People Operations','Hiring, onboarding, performance','👥','#e11d48',
    E'# People Operations\n\n## What this skill owns\nSourcing, interview loops, offers, onboarding, performance cycles.\n\n## Quality bar\n- Every interview loop has structured scorecards\n- Offer-to-accept conversion tracked monthly'),
  ('founder','skill','Founder / CEO','Vision, strategy, capital, board','⭐','#facc15',
    E'# Founder / CEO\n\n## What this skill owns\nStrategy, fundraising, hiring leadership, board management, north-star communication.\n\n## Quality bar\n- 18-month vision documented and refreshed quarterly\n- Board package shipped 72h before each meeting');

-- =============================================================================
-- Section 3: Playbooks (34 — names real teams use)
-- =============================================================================
insert into public.framework_items (id, type, name, description, icon, color, content) values
  -- Strategy
  ('okr-planning','playbook','OKR Planning','Set objectives and key results for the quarter','🎯','#facc15',
    E'# OKR Planning\n\n## Objective\nProduce a clear, signed-off OKR set for the upcoming quarter.\n\n## Steps\n1. Review previous quarter scoring\n2. Draft 3 company objectives\n3. Per objective, 3-5 measurable key results\n4. Stress-test with leadership\n5. Publish OKR doc'),
  ('market-research','playbook','Market Research','Segment scan, competitor landscape, sizing','🔬','#8b5cf6',
    E'# Market Research\n\n## Objective\nMap the addressable market and competitive landscape.\n\n## Steps\n1. Define segments\n2. Sizing (TAM/SAM/SOM)\n3. Competitor scan\n4. Synthesize into a research memo'),
  ('positioning-brief','playbook','Positioning Brief','Statement of position, differentiation, target','🧭','#facc15',
    E'# Positioning Brief\n\n## Objective\nLock the positioning statement, differentiation, and target buyer.\n\n## Steps\n1. Read market-research memo\n2. Draft positioning statement\n3. Map differentiation vs top 3 competitors\n4. Validate with 3 customer conversations\n5. Publish positioning brief'),
  -- Product Discovery
  ('problem-statement','playbook','Problem Statement','User, goal, constraints, success metric','📝','#6366f1',
    E'# Problem Statement\n\n## Objective\nA written, sharable description of who has the problem and what success looks like.'),
  ('discovery-interview','playbook','Discovery Interview','User interviews and verbatim capture','🎙️','#8b5cf6',
    E'# Discovery Interview\n\n## Objective\nUnstructured-to-structured interview series. Capture verbatims, then synthesize themes.\n\n## Steps\n1. Build interview guide\n2. Recruit ≥ 5 users\n3. Run sessions, record\n4. Transcribe verbatims\n5. Tag and synthesize'),
  ('solution-exploration','playbook','Solution Exploration','Diverge then converge on candidate solutions','💡','#6366f1',
    E'# Solution Exploration\n\n## Objective\nGenerate 3-5 candidate solutions, then converge on one to validate.'),
  ('validation-test','playbook','Validation Test','Prototype test or fake-door test','🧪','#8b5cf6',
    E'# Validation Test\n\n## Objective\nEvidence that the proposed solution moves the metric.'),
  -- Product Sprint
  ('sprint-planning','playbook','Sprint Planning','Goal, scope, capacity, commit','🗓️','#6366f1',
    E'# Sprint Planning\n\n## Objective\nA sprint goal and a committed scope sized to capacity.\n\n## Steps\n1. Review carryover\n2. Confirm capacity (PTO, meetings)\n3. Pick stories that ladder to the OKR\n4. Estimate, commit, sequence'),
  ('product-spec','playbook','Product Spec','Acceptance criteria, edge cases, data model','📐','#6366f1',
    E'# Product Spec\n\n## Objective\nA spec the team can implement against without further clarification.\n\n## Quality gate\n- `npm run validate` passes against the spec yaml'),
  ('design-handoff','playbook','Design Handoff','Hi-fi designs with redlines and tokens','🎨','#ec4899',
    E'# Design Handoff\n\n## Objective\nDesigns ready to implement: states, tokens, redlines, accessibility notes.'),
  ('engineering-build','playbook','Engineering Build','Vertical slice: UI + API + persistence + telemetry','⚡','#0ea5e9',
    E'# Engineering Build\n\n## Objective\nA shipped vertical slice on staging with telemetry wired.'),
  ('code-review','playbook','Code Review','Correctness, security, performance, style','🔍','#0ea5e9',
    E'# Code Review\n\n## Objective\nA reviewed PR that meets the team standard before merge.'),
  ('qa-signoff','playbook','QA Signoff','Test plan, regression, release gate','✅','#10b981',
    E'# QA Signoff\n\n## Objective\nGreen E2E + acceptance test results before release.'),
  ('release-notes','playbook','Release Notes','Customer-facing changelog entry','📰','#f59e0b',
    E'# Release Notes\n\n## Objective\nA changelog entry customers can read.'),
  ('feature-analytics-review','playbook','Feature Analytics Review','Adoption + impact 14 days post-ship','📊','#22c55e',
    E'# Feature Analytics Review\n\n## Objective\nDecide: double-down, iterate, or sunset.'),
  -- Design System
  ('design-token-audit','playbook','Design Token Audit','Find hardcoded values, drift vs tokens','🎨','#ec4899',
    E'# Design Token Audit\n\n## Objective\nA list of every off-token value in the app.'),
  ('component-spec','playbook','Component Spec','Variants, states, props, a11y','🧩','#ec4899',
    E'# Component Spec\n\n## Objective\nA spec a developer can build a new component from.'),
  ('component-library-update','playbook','Component Library Update','Build + ship in Storybook','📚','#0ea5e9',
    E'# Component Library Update\n\n## Objective\nA new or refreshed component published in Storybook.'),
  -- Launch
  ('icp-definition','playbook','ICP Definition','Ideal customer profile + JTBD','🎯','#f97316',
    E'# ICP Definition\n\n## Objective\nA precise ICP doc the entire GTM team aligns to.'),
  ('messaging-house','playbook','Messaging House','Top message, pillars, proofs','🏛️','#f97316',
    E'# Messaging House\n\n## Objective\nA messaging architecture: top message, 3 pillars, proof points per pillar.'),
  ('launch-landing-page','playbook','Launch Landing Page','Copy, design, build, analytics','🌐','#22c55e',
    E'# Launch Landing Page\n\n## Objective\nLanding page live with hero copy, social proof, CTA, and analytics wired.'),
  ('launch-content-pack','playbook','Launch Content Pack','Blog + social + email','✍️','#22c55e',
    E'# Launch Content Pack\n\n## Objective\nThe full asset pack for launch day.'),
  ('launch-day-runbook','playbook','Launch Day Runbook','Hour-by-hour plan, owners, channels','🚀','#f97316',
    E'# Launch Day Runbook\n\n## Objective\nA timed checklist with named owners per item.'),
  ('launch-retro','playbook','Launch Retro','What worked, what did not, follow-ups','📓','#f97316',
    E'# Launch Retro\n\n## Objective\nDocumented learnings and 5 follow-up commits.'),
  -- Sales Cycle
  ('prospect-list-build','playbook','Prospect List Build','ICP-fit accounts and contacts','📇','#06b6d4',
    E'# Prospect List Build\n\n## Objective\nA targeted list of accounts and named contacts ready for outbound.'),
  ('outbound-sequence','playbook','Outbound Sequence','Cold email + LinkedIn cadence','📧','#06b6d4',
    E'# Outbound Sequence\n\n## Objective\nA running, measurable outbound cadence.'),
  ('discovery-call','playbook','Discovery Call','Qualify, identify champion, scope','📞','#06b6d4',
    E'# Discovery Call\n\n## Objective\nA filled MEDDPICC and a confirmed champion.'),
  ('tailored-demo','playbook','Tailored Demo','Story aligned to discovery findings','🎬','#06b6d4',
    E'# Tailored Demo\n\n## Objective\nA demo that maps each feature to a discovered pain.'),
  ('pricing-proposal','playbook','Pricing Proposal','Scope, pricing, terms','💵','#a855f7',
    E'# Pricing Proposal\n\n## Objective\nA written proposal the buyer can take to procurement.'),
  ('contract-signature','playbook','Contract Signature','Redlines, MSA, sign','✍️','#a855f7',
    E'# Contract Signature\n\n## Objective\nA signed contract.'),
  ('cs-handoff','playbook','CS Handoff','Account context to Customer Success','🤝','#14b8a6',
    E'# CS Handoff\n\n## Objective\nA handoff doc CS can run onboarding from.'),
  -- Customer Onboarding
  ('kickoff-call','playbook','Kickoff Call','Goals, stakeholders, success criteria','📅','#14b8a6',
    E'# Kickoff Call\n\n## Objective\nKickoff complete with success criteria captured.'),
  ('account-provisioning','playbook','Account Provisioning','Tenant created, users invited','🔌','#0ea5e9',
    E'# Account Provisioning\n\n## Objective\nA provisioned tenant the customer can sign in to.'),
  ('data-import','playbook','Data Import','Bring customer data into the platform','📥','#0ea5e9',
    E'# Data Import\n\n## Objective\nCustomer data loaded and verified.'),
  ('success-criteria','playbook','Success Criteria','What "good" looks like at day 30','🎯','#14b8a6',
    E'# Success Criteria\n\n## Objective\nA shared, measurable definition of onboarding success.'),
  ('activation-checklist','playbook','Activation Checklist','Steps to first value','✅','#14b8a6',
    E'# Activation Checklist\n\n## Objective\nA tracked checklist of the steps that lead to first value.'),
  ('thirty-day-review','playbook','30-Day Review','Adoption check, blockers, next steps','📊','#14b8a6',
    E'# 30-Day Review\n\n## Objective\nA written review of where the customer is vs success criteria.'),
  -- Customer Success Loop
  ('health-score','playbook','Health Score','Quantitative + qualitative account signal','🩺','#14b8a6',
    E'# Health Score\n\n## Objective\nA current health score per account.'),
  ('qbr','playbook','QBR','Quarterly business review with customer','🗣️','#14b8a6',
    E'# QBR\n\n## Objective\nA QBR deck delivered and follow-ups captured.'),
  ('expansion-plan','playbook','Expansion Plan','Identify and pursue upsell','📈','#06b6d4',
    E'# Expansion Plan\n\n## Objective\nA written plan for expanding revenue inside the account.'),
  ('renewal-prep','playbook','Renewal Prep','Terms, risks, mitigation','🔁','#14b8a6',
    E'# Renewal Prep\n\n## Objective\nRenewal terms agreed 60 days before contract end.'),
  ('nps-pulse','playbook','NPS Pulse','Per-quarter NPS read','📉','#22c55e',
    E'# NPS Pulse\n\n## Objective\nA quarterly NPS score with verbatims.'),
  -- Incident Response
  ('incident-triage','playbook','Incident Triage','Severity, scope, affected users','🚨','#dc2626',
    E'# Incident Triage\n\n## Objective\nIncident classified with severity and a named IC.'),
  ('incident-resolution','playbook','Incident Resolution','Investigate, fix, deploy','🔥','#dc2626',
    E'# Incident Resolution\n\n## Objective\nFix deployed and verified in production.'),
  ('customer-comms','playbook','Customer Comms','Status page + targeted comms','📡','#3b82f6',
    E'# Customer Comms\n\n## Objective\nAffected customers informed within SLA.'),
  ('postmortem','playbook','Postmortem','Timeline, root cause, action items','📓','#64748b',
    E'# Postmortem\n\n## Objective\nA blameless postmortem with named follow-up owners.'),
  -- Hiring
  ('role-jd','playbook','Role & JD','Role spec and published JD','📄','#e11d48',
    E'# Role & JD\n\n## Objective\nA published JD aligned to hiring rubric.'),
  ('candidate-screen','playbook','Candidate Screen','30-min recruiter / hiring manager screen','📞','#e11d48',
    E'# Candidate Screen\n\n## Objective\nA scored screen that decides next-step or pass.'),
  ('interview-loop','playbook','Interview Loop','Structured panel with scorecards','🧑‍💼','#e11d48',
    E'# Interview Loop\n\n## Objective\nCompleted scorecards from every interviewer.'),
  ('offer-letter','playbook','Offer Letter','Compensation, equity, terms','📝','#a855f7',
    E'# Offer Letter\n\n## Objective\nAn accepted, signed offer.'),
  ('new-hire-onboarding','playbook','New Hire Onboarding','First 30 / 60 / 90 plan','🎓','#e11d48',
    E'# New Hire Onboarding\n\n## Objective\nA new hire ramped to first independent contribution.');

-- =============================================================================
-- Section 4: framework_item_allowed_skills mapping
-- Drives which Skills can pick which Playbooks on the matrix.
-- =============================================================================
insert into public.framework_item_allowed_skills (playbook_id, skill_id) values
  -- Strategy
  ('okr-planning','founder'),
  ('okr-planning','product-manager'),
  ('market-research','user-researcher'),
  ('market-research','product-marketing-manager'),
  ('positioning-brief','product-marketing-manager'),
  ('positioning-brief','founder'),
  -- Product Discovery
  ('problem-statement','product-manager'),
  ('discovery-interview','user-researcher'),
  ('discovery-interview','product-manager'),
  ('solution-exploration','product-manager'),
  ('solution-exploration','product-designer'),
  ('validation-test','user-researcher'),
  ('validation-test','product-designer'),
  -- Product Sprint
  ('sprint-planning','engineering-manager'),
  ('sprint-planning','product-manager'),
  ('product-spec','product-manager'),
  ('design-handoff','product-designer'),
  ('engineering-build','software-engineer'),
  ('code-review','software-engineer'),
  ('code-review','engineering-manager'),
  ('qa-signoff','qa-engineer'),
  ('release-notes','product-marketing-manager'),
  ('release-notes','product-manager'),
  ('feature-analytics-review','product-manager'),
  -- Design System
  ('design-token-audit','product-designer'),
  ('component-spec','product-designer'),
  ('component-library-update','software-engineer'),
  -- Launch
  ('icp-definition','product-marketing-manager'),
  ('messaging-house','product-marketing-manager'),
  ('launch-landing-page','growth-marketer'),
  ('launch-content-pack','growth-marketer'),
  ('launch-content-pack','product-marketing-manager'),
  ('launch-day-runbook','product-marketing-manager'),
  ('launch-day-runbook','founder'),
  ('launch-retro','product-marketing-manager'),
  ('launch-retro','growth-marketer'),
  -- Sales Cycle
  ('prospect-list-build','growth-marketer'),
  ('prospect-list-build','account-executive'),
  ('outbound-sequence','account-executive'),
  ('outbound-sequence','growth-marketer'),
  ('discovery-call','account-executive'),
  ('tailored-demo','account-executive'),
  ('pricing-proposal','account-executive'),
  ('pricing-proposal','finance-operations'),
  ('contract-signature','account-executive'),
  ('contract-signature','finance-operations'),
  ('cs-handoff','account-executive'),
  ('cs-handoff','customer-success-manager'),
  -- Customer Onboarding
  ('kickoff-call','customer-success-manager'),
  ('account-provisioning','software-engineer'),
  ('account-provisioning','customer-support-engineer'),
  ('data-import','customer-support-engineer'),
  ('data-import','software-engineer'),
  ('success-criteria','customer-success-manager'),
  ('activation-checklist','customer-success-manager'),
  ('thirty-day-review','customer-success-manager'),
  -- Customer Success Loop
  ('health-score','customer-success-manager'),
  ('qbr','customer-success-manager'),
  ('expansion-plan','customer-success-manager'),
  ('expansion-plan','account-executive'),
  ('renewal-prep','customer-success-manager'),
  ('renewal-prep','finance-operations'),
  ('nps-pulse','customer-success-manager'),
  -- Incident Response
  ('incident-triage','site-reliability-engineer'),
  ('incident-triage','customer-support-engineer'),
  ('incident-resolution','software-engineer'),
  ('incident-resolution','site-reliability-engineer'),
  ('customer-comms','customer-support-engineer'),
  ('customer-comms','product-manager'),
  ('postmortem','product-manager'),
  ('postmortem','site-reliability-engineer'),
  -- Hiring
  ('role-jd','people-operations'),
  ('role-jd','engineering-manager'),
  ('candidate-screen','people-operations'),
  ('candidate-screen','engineering-manager'),
  ('interview-loop','engineering-manager'),
  ('interview-loop','people-operations'),
  ('offer-letter','people-operations'),
  ('offer-letter','founder'),
  ('new-hire-onboarding','people-operations');


-- =============================================================================
-- Section 5: playbook_outputs (~52 — each playbook gets 1-3 named outputs)
-- =============================================================================
insert into public.playbook_outputs (playbook_id, name, description, kind, position) values
  -- Strategy
  ('okr-planning','OKR Doc','Signed-off quarterly OKR document','file',0),
  ('market-research','Research Memo','Market scan with sizing and competitors','file',0),
  ('positioning-brief','Positioning Brief','Statement + differentiation + target','file',0),
  -- Product Discovery
  ('problem-statement','Problem Brief','Who has the problem and what success looks like','file',0),
  ('discovery-interview','Interview Notes','Verbatim notes per session','file',0),
  ('discovery-interview','Insight Synthesis','Themes and quotes ready to inform solution','file',1),
  ('solution-exploration','Solution Memo','Selected solution direction with rationale','file',0),
  ('validation-test','Validation Report','Test results vs success metric','file',0),
  -- Product Sprint
  ('sprint-planning','Sprint Goal','Sprint goal and committed scope list','manual',0),
  ('product-spec','Spec Doc','Acceptance criteria, edge cases, data model','file',0),
  ('design-handoff','Figma Link','Hi-fi link with redlines','link',0),
  ('engineering-build','PR Link','GitHub PR with the implemented slice','link',0),
  ('engineering-build','Staging URL','Deployed slice on staging','link',1),
  ('code-review','Review Summary','Notes from code review with any follow-ups','manual',0),
  ('qa-signoff','Test Report','E2E + acceptance results','api',0),
  ('release-notes','Release Notes','Customer-facing changelog entry','file',0),
  ('feature-analytics-review','Metrics Dashboard','Adoption and impact dashboard link','link',0),
  -- Design System
  ('design-token-audit','Audit Memo','List of off-token values and prioritization','file',0),
  ('component-spec','Component Spec','Variants, states, props, a11y','file',0),
  ('component-library-update','Storybook Link','Published Storybook entry','link',0),
  -- Launch
  ('icp-definition','ICP Doc','Defined ICP and JTBD','file',0),
  ('messaging-house','Messaging Doc','Top message, pillars, proofs','file',0),
  ('launch-landing-page','Landing Page URL','Live landing page','link',0),
  ('launch-landing-page','Page Analytics','Conversion analytics dashboard','link',1),
  ('launch-content-pack','Content Pack','Blog + social + email assets','file',0),
  ('launch-day-runbook','Runbook Doc','Hour-by-hour launch day plan','file',0),
  ('launch-retro','Retro Memo','What worked, what did not, follow-ups','file',0),
  -- Sales Cycle
  ('prospect-list-build','Prospect List','Targeted accounts + contacts','file',0),
  ('outbound-sequence','Sequence Link','Outreach sequence in tool','link',0),
  ('discovery-call','Discovery Notes','MEDDPICC fields and notes','manual',0),
  ('tailored-demo','Demo Recording','Recording of tailored demo','media',0),
  ('pricing-proposal','Proposal PDF','Proposal document','file',0),
  ('contract-signature','Signed Contract','Counter-signed contract','file',0),
  ('cs-handoff','Handoff Doc','Context handoff to CS','file',0),
  -- Customer Onboarding
  ('kickoff-call','Kickoff Notes','Goals, stakeholders, action items','manual',0),
  ('account-provisioning','Provisioned Tenant','Tenant ready for sign-in','api',0),
  ('data-import','Import Confirmation','Loaded data verified','manual',0),
  ('success-criteria','Success Criteria Doc','Day-30 success definition','file',0),
  ('activation-checklist','Checklist Completion','Activation checklist marked complete','manual',0),
  ('thirty-day-review','Review Memo','30-day review with adoption snapshot','file',0),
  -- Customer Success Loop
  ('health-score','Account Health Score','Current health score','manual',0),
  ('qbr','QBR Deck','QBR slide deck','file',0),
  ('expansion-plan','Expansion Plan Doc','Plan for expansion in the account','file',0),
  ('renewal-prep','Renewal Terms','Agreed renewal terms','file',0),
  ('nps-pulse','NPS Dashboard','Quarterly NPS read','link',0),
  -- Incident Response
  ('incident-triage','Triage Summary','Severity, scope, IC, affected users','manual',0),
  ('incident-resolution','Fix PR','Pull request with the fix','link',0),
  ('incident-resolution','Deploy Confirmation','Deploy verified in production','api',1),
  ('customer-comms','Status Page Update','Public status post','link',0),
  ('postmortem','Postmortem Doc','Blameless postmortem with action items','file',0),
  -- Hiring
  ('role-jd','Published JD','JD live on careers page','link',0),
  ('candidate-screen','Screen Notes','Recruiter / hiring manager screen notes','manual',0),
  ('interview-loop','Scorecards','Completed interview scorecards','file',0),
  ('offer-letter','Signed Offer','Counter-signed offer letter','file',0),
  ('new-hire-onboarding','Onboarding Plan','30/60/90 plan in place','file',0);

-- =============================================================================
-- Section 6: playbook_inputs (each row points at an upstream playbook_outputs)
-- Looked up by (playbook_id, name) since output ids are gen_random_uuid().
-- =============================================================================
with src as (
  select id, playbook_id, name from public.playbook_outputs
)
insert into public.playbook_inputs (playbook_id, upstream_output_id, position)
select i.downstream_id, src.id, i.position
from (values
  -- Strategy
  ('positioning-brief',     'market-research',          'Research Memo',          0),
  -- Product Discovery
  ('discovery-interview',   'problem-statement',        'Problem Brief',          0),
  ('solution-exploration',  'discovery-interview',      'Insight Synthesis',      0),
  ('validation-test',       'solution-exploration',     'Solution Memo',          0),
  -- Product Sprint
  ('product-spec',          'discovery-interview',      'Insight Synthesis',      0),
  ('design-handoff',        'product-spec',             'Spec Doc',               0),
  ('engineering-build',     'product-spec',             'Spec Doc',               0),
  ('engineering-build',     'design-handoff',           'Figma Link',             1),
  ('code-review',           'engineering-build',        'PR Link',                0),
  ('qa-signoff',            'engineering-build',        'Staging URL',            0),
  ('release-notes',         'engineering-build',        'PR Link',                0),
  -- Design System
  ('component-spec',        'design-token-audit',       'Audit Memo',             0),
  ('component-library-update','component-spec',         'Component Spec',         0),
  -- Launch
  ('messaging-house',       'positioning-brief',        'Positioning Brief',      0),
  ('launch-landing-page',   'messaging-house',          'Messaging Doc',          0),
  ('launch-content-pack',   'messaging-house',          'Messaging Doc',          0),
  ('launch-retro',          'launch-landing-page',      'Page Analytics',         0),
  -- Sales Cycle
  ('outbound-sequence',     'prospect-list-build',      'Prospect List',          0),
  ('tailored-demo',         'discovery-call',           'Discovery Notes',        0),
  ('pricing-proposal',      'discovery-call',           'Discovery Notes',        0),
  ('contract-signature',    'pricing-proposal',         'Proposal PDF',           0),
  ('cs-handoff',            'contract-signature',       'Signed Contract',        0),
  -- Customer Onboarding
  ('kickoff-call',          'cs-handoff',               'Handoff Doc',            0),
  ('thirty-day-review',     'success-criteria',         'Success Criteria Doc',   0),
  -- Customer Success Loop
  ('qbr',                   'health-score',             'Account Health Score',   0),
  ('expansion-plan',        'qbr',                      'QBR Deck',               0),
  ('renewal-prep',          'qbr',                      'QBR Deck',               0),
  -- Incident Response
  ('incident-resolution',   'incident-triage',          'Triage Summary',         0),
  ('customer-comms',        'incident-triage',          'Triage Summary',         0),
  ('postmortem',            'incident-resolution',      'Deploy Confirmation',    0),
  -- Hiring
  ('candidate-screen',      'role-jd',                  'Published JD',           0),
  ('interview-loop',        'candidate-screen',         'Screen Notes',           0),
  ('offer-letter',          'interview-loop',           'Scorecards',             0),
  ('new-hire-onboarding',   'offer-letter',             'Signed Offer',           0)
) as i(downstream_id, upstream_playbook_id, upstream_output_name, position)
join src on src.playbook_id = i.upstream_playbook_id and src.name = i.upstream_output_name;


-- =============================================================================
-- Section 7: workflow_templates (10) — task_templates inserted with empty
-- inputs[]/outputs[] arrays; the UPDATE at the end of this section snapshots
-- them from playbook_outputs / playbook_inputs by playbookId.
-- =============================================================================
insert into public.workflow_templates (id, label, color, multi_instance, stages, skills, task_templates) values
  -- Strategy & OKRs
  ('strategy-okrs','Strategy & OKRs','#facc15',false,
    '[{"id":"frame","label":"Frame","sub":"Question"},{"id":"research","label":"Research","sub":"Inputs"},{"id":"decide","label":"Decide","sub":"OKRs"},{"id":"communicate","label":"Communicate","sub":"All-hands"}]'::jsonb,
    '[{"id":"founder","label":"Founder / CEO","owners":["Andres Elizondo (Founder)"]},{"id":"product-manager","label":"Product Manager","owners":["Maya Chen (Product Lead)","Atlas (PM copilot)"]},{"id":"user-researcher","label":"User Researcher","owners":["Lumen (Research copilot)"]}]'::jsonb,
    '[
      {"id":"tt-strategy-okrs-1","skillId":"founder","stageId":"frame","playbookId":"problem-statement","notes":"Frame the strategic question for the quarter","owners":["Andres Elizondo (Founder)"],"inputs":[],"outputs":[]},
      {"id":"tt-strategy-okrs-2","skillId":"user-researcher","stageId":"research","playbookId":"market-research","notes":"","owners":["Lumen (Research copilot)"],"inputs":[],"outputs":[]},
      {"id":"tt-strategy-okrs-3","skillId":"product-manager","stageId":"research","playbookId":"positioning-brief","notes":"","owners":["Maya Chen (Product Lead)"],"inputs":[],"outputs":[]},
      {"id":"tt-strategy-okrs-4","skillId":"founder","stageId":"decide","playbookId":"okr-planning","notes":"","checkpoint":true,"owners":["Andres Elizondo (Founder)"],"inputs":[],"outputs":[]},
      {"id":"tt-strategy-okrs-5","skillId":"product-manager","stageId":"communicate","playbookId":"release-notes","notes":"All-hands deck and announcement","owners":["Maya Chen (Product Lead)"],"inputs":[],"outputs":[]}
    ]'::jsonb),

  -- Product Discovery
  ('product-discovery','Product Discovery','#8b5cf6',false,
    '[{"id":"problem","label":"Problem","sub":"Frame"},{"id":"research","label":"Research","sub":"Listen"},{"id":"solution","label":"Solution","sub":"Diverge / converge"},{"id":"validation","label":"Validation","sub":"Evidence"}]'::jsonb,
    '[{"id":"product-manager","label":"Product Manager","owners":["Maya Chen (Product Lead)","Atlas (PM copilot)"]},{"id":"user-researcher","label":"User Researcher","owners":["Lumen (Research copilot)"]},{"id":"product-designer","label":"Product Designer","owners":["Riya Patel (Sr. Designer)","Pixel (Design copilot)"]}]'::jsonb,
    '[
      {"id":"tt-product-discovery-1","skillId":"product-manager","stageId":"problem","playbookId":"problem-statement","notes":"","owners":["Maya Chen (Product Lead)"],"inputs":[],"outputs":[]},
      {"id":"tt-product-discovery-2","skillId":"user-researcher","stageId":"research","playbookId":"discovery-interview","notes":"At least 5 interviews","owners":["Lumen (Research copilot)"],"inputs":[],"outputs":[]},
      {"id":"tt-product-discovery-3","skillId":"product-designer","stageId":"solution","playbookId":"solution-exploration","notes":"","owners":["Riya Patel (Sr. Designer)","Pixel (Design copilot)"],"inputs":[],"outputs":[]},
      {"id":"tt-product-discovery-4","skillId":"user-researcher","stageId":"validation","playbookId":"validation-test","notes":"","checkpoint":true,"owners":["Lumen (Research copilot)"],"inputs":[],"outputs":[]},
      {"id":"tt-product-discovery-5","skillId":"product-manager","stageId":"validation","playbookId":"release-notes","notes":"Discovery readout to the team","owners":["Maya Chen (Product Lead)"],"inputs":[],"outputs":[]}
    ]'::jsonb),

  -- Product Sprint
  ('product-sprint','Product Sprint','#6366f1',true,
    '[{"id":"plan","label":"Plan","sub":"Goal & scope"},{"id":"design","label":"Design","sub":"Hi-fi & redlines"},{"id":"build","label":"Build","sub":"Vertical slice"},{"id":"review","label":"Review","sub":"Code review"},{"id":"ship","label":"Ship","sub":"Release"},{"id":"measure","label":"Measure","sub":"Adoption"}]'::jsonb,
    '[{"id":"engineering-manager","label":"Engineering Manager","owners":["Diego Alvarez (Eng Lead)"]},{"id":"product-manager","label":"Product Manager","owners":["Maya Chen (Product Lead)","Atlas (PM copilot)"]},{"id":"product-designer","label":"Product Designer","owners":["Riya Patel (Sr. Designer)","Pixel (Design copilot)"]},{"id":"software-engineer","label":"Software Engineer","owners":["Diego Alvarez (Eng Lead)","Forge (Eng copilot)"]},{"id":"qa-engineer","label":"QA Engineer","owners":["Mira Park (QA Lead)"]}]'::jsonb,
    '[
      {"id":"tt-product-sprint-1","skillId":"engineering-manager","stageId":"plan","playbookId":"sprint-planning","notes":"","owners":["Diego Alvarez (Eng Lead)"],"inputs":[],"outputs":[]},
      {"id":"tt-product-sprint-2","skillId":"product-manager","stageId":"plan","playbookId":"product-spec","notes":"","owners":["Maya Chen (Product Lead)","Atlas (PM copilot)"],"inputs":[],"outputs":[]},
      {"id":"tt-product-sprint-3","skillId":"product-designer","stageId":"design","playbookId":"design-handoff","notes":"","checkpoint":true,"owners":["Riya Patel (Sr. Designer)","Pixel (Design copilot)"],"inputs":[],"outputs":[]},
      {"id":"tt-product-sprint-4","skillId":"software-engineer","stageId":"build","playbookId":"engineering-build","notes":"","owners":["Diego Alvarez (Eng Lead)","Forge (Eng copilot)"],"inputs":[],"outputs":[]},
      {"id":"tt-product-sprint-5","skillId":"software-engineer","stageId":"review","playbookId":"code-review","notes":"","owners":["Diego Alvarez (Eng Lead)"],"inputs":[],"outputs":[]},
      {"id":"tt-product-sprint-6","skillId":"qa-engineer","stageId":"review","playbookId":"qa-signoff","notes":"","checkpoint":true,"owners":["Mira Park (QA Lead)"],"inputs":[],"outputs":[]},
      {"id":"tt-product-sprint-7","skillId":"product-manager","stageId":"ship","playbookId":"release-notes","notes":"","owners":["Maya Chen (Product Lead)"],"inputs":[],"outputs":[]},
      {"id":"tt-product-sprint-8","skillId":"product-manager","stageId":"measure","playbookId":"feature-analytics-review","notes":"","owners":["Maya Chen (Product Lead)","Atlas (PM copilot)"],"inputs":[],"outputs":[]}
    ]'::jsonb),

  -- Design System Evolution
  ('design-system','Design System Evolution','#ec4899',false,
    '[{"id":"audit","label":"Audit","sub":"Find drift"},{"id":"propose","label":"Propose","sub":"Spec"},{"id":"build","label":"Build","sub":"Storybook"},{"id":"adopt","label":"Adopt","sub":"Roll out"}]'::jsonb,
    '[{"id":"product-designer","label":"Product Designer","owners":["Riya Patel (Sr. Designer)","Pixel (Design copilot)"]},{"id":"product-manager","label":"Product Manager","owners":["Maya Chen (Product Lead)"]},{"id":"software-engineer","label":"Software Engineer","owners":["Diego Alvarez (Eng Lead)","Forge (Eng copilot)"]}]'::jsonb,
    '[
      {"id":"tt-design-system-1","skillId":"product-designer","stageId":"audit","playbookId":"design-token-audit","notes":"","owners":["Riya Patel (Sr. Designer)"],"inputs":[],"outputs":[]},
      {"id":"tt-design-system-2","skillId":"product-designer","stageId":"propose","playbookId":"component-spec","notes":"","checkpoint":true,"owners":["Riya Patel (Sr. Designer)","Pixel (Design copilot)"],"inputs":[],"outputs":[]},
      {"id":"tt-design-system-3","skillId":"software-engineer","stageId":"build","playbookId":"component-library-update","notes":"","owners":["Forge (Eng copilot)"],"inputs":[],"outputs":[]},
      {"id":"tt-design-system-4","skillId":"product-manager","stageId":"adopt","playbookId":"release-notes","notes":"Adoption announcement + migration guide","owners":["Maya Chen (Product Lead)"],"inputs":[],"outputs":[]}
    ]'::jsonb),

  -- Product Launch
  ('launch','Product Launch','#f97316',false,
    '[{"id":"positioning","label":"Positioning","sub":"ICP & message"},{"id":"assets","label":"Assets","sub":"Pages & content"},{"id":"prelaunch","label":"Pre-launch","sub":"Runbook"},{"id":"launchday","label":"Launch day","sub":"Go live"},{"id":"retro","label":"Retro","sub":"Learnings"}]'::jsonb,
    '[{"id":"product-marketing-manager","label":"Product Marketing Manager","owners":["Sam Okafor (DevRel/PMM)"]},{"id":"growth-marketer","label":"Growth Marketer","owners":["Vega (Growth copilot)"]},{"id":"product-manager","label":"Product Manager","owners":["Maya Chen (Product Lead)"]},{"id":"founder","label":"Founder / CEO","owners":["Andres Elizondo (Founder)"]}]'::jsonb,
    '[
      {"id":"tt-launch-1","skillId":"product-marketing-manager","stageId":"positioning","playbookId":"icp-definition","notes":"","owners":["Sam Okafor (DevRel/PMM)"],"inputs":[],"outputs":[]},
      {"id":"tt-launch-2","skillId":"product-marketing-manager","stageId":"positioning","playbookId":"messaging-house","notes":"","checkpoint":true,"owners":["Sam Okafor (DevRel/PMM)"],"inputs":[],"outputs":[]},
      {"id":"tt-launch-3","skillId":"growth-marketer","stageId":"assets","playbookId":"launch-landing-page","notes":"","owners":["Vega (Growth copilot)"],"inputs":[],"outputs":[]},
      {"id":"tt-launch-4","skillId":"growth-marketer","stageId":"assets","playbookId":"launch-content-pack","notes":"","owners":["Vega (Growth copilot)","Sam Okafor (DevRel/PMM)"],"inputs":[],"outputs":[]},
      {"id":"tt-launch-5","skillId":"product-marketing-manager","stageId":"prelaunch","playbookId":"launch-day-runbook","notes":"","owners":["Sam Okafor (DevRel/PMM)"],"inputs":[],"outputs":[]},
      {"id":"tt-launch-6","skillId":"founder","stageId":"launchday","playbookId":"release-notes","notes":"Founder note + social","owners":["Andres Elizondo (Founder)"],"inputs":[],"outputs":[]},
      {"id":"tt-launch-7","skillId":"product-marketing-manager","stageId":"retro","playbookId":"launch-retro","notes":"","owners":["Sam Okafor (DevRel/PMM)"],"inputs":[],"outputs":[]}
    ]'::jsonb),

  -- Sales Cycle
  ('sales-cycle','Sales Cycle','#06b6d4',true,
    '[{"id":"prospect","label":"Prospect","sub":"Build list"},{"id":"qualify","label":"Qualify","sub":"Discovery"},{"id":"demo","label":"Demo","sub":"Tailored"},{"id":"negotiate","label":"Negotiate","sub":"Proposal"},{"id":"close","label":"Close","sub":"Sign"},{"id":"handoff","label":"Handoff","sub":"To CS"}]'::jsonb,
    '[{"id":"account-executive","label":"Account Executive","owners":["Jordan Wu (AE)"]},{"id":"growth-marketer","label":"Growth Marketer","owners":["Vega (Growth copilot)"]},{"id":"customer-success-manager","label":"Customer Success Manager","owners":["Priya Shah (CSM)"]},{"id":"finance-operations","label":"Finance Operations","owners":["Theo Nakamura (FinOps)"]}]'::jsonb,
    '[
      {"id":"tt-sales-cycle-1","skillId":"growth-marketer","stageId":"prospect","playbookId":"prospect-list-build","notes":"","owners":["Vega (Growth copilot)"],"inputs":[],"outputs":[]},
      {"id":"tt-sales-cycle-2","skillId":"account-executive","stageId":"prospect","playbookId":"outbound-sequence","notes":"","owners":["Jordan Wu (AE)","Vega (Growth copilot)"],"inputs":[],"outputs":[]},
      {"id":"tt-sales-cycle-3","skillId":"account-executive","stageId":"qualify","playbookId":"discovery-call","notes":"","owners":["Jordan Wu (AE)"],"inputs":[],"outputs":[]},
      {"id":"tt-sales-cycle-4","skillId":"account-executive","stageId":"demo","playbookId":"tailored-demo","notes":"","owners":["Jordan Wu (AE)"],"inputs":[],"outputs":[]},
      {"id":"tt-sales-cycle-5","skillId":"account-executive","stageId":"negotiate","playbookId":"pricing-proposal","notes":"","checkpoint":true,"owners":["Jordan Wu (AE)","Theo Nakamura (FinOps)"],"inputs":[],"outputs":[]},
      {"id":"tt-sales-cycle-6","skillId":"finance-operations","stageId":"close","playbookId":"contract-signature","notes":"","owners":["Theo Nakamura (FinOps)"],"inputs":[],"outputs":[]},
      {"id":"tt-sales-cycle-7","skillId":"customer-success-manager","stageId":"handoff","playbookId":"cs-handoff","notes":"","owners":["Priya Shah (CSM)","Jordan Wu (AE)"],"inputs":[],"outputs":[]}
    ]'::jsonb),

  -- Customer Onboarding
  ('customer-onboarding','Customer Onboarding','#14b8a6',true,
    '[{"id":"kickoff","label":"Kickoff","sub":"Goals"},{"id":"setup","label":"Setup","sub":"Provision"},{"id":"activation","label":"Activation","sub":"First value"},{"id":"review","label":"30-day Review","sub":"Adoption"}]'::jsonb,
    '[{"id":"customer-success-manager","label":"Customer Success Manager","owners":["Priya Shah (CSM)"]},{"id":"customer-support-engineer","label":"Customer Support Engineer","owners":["Noor Hassan (Support Eng)"]},{"id":"finance-operations","label":"Finance Operations","owners":["Theo Nakamura (FinOps)"]},{"id":"software-engineer","label":"Software Engineer","owners":["Forge (Eng copilot)"]}]'::jsonb,
    '[
      {"id":"tt-customer-onboarding-1","skillId":"customer-success-manager","stageId":"kickoff","playbookId":"kickoff-call","notes":"","owners":["Priya Shah (CSM)"],"inputs":[],"outputs":[]},
      {"id":"tt-customer-onboarding-2","skillId":"customer-success-manager","stageId":"kickoff","playbookId":"success-criteria","notes":"","owners":["Priya Shah (CSM)"],"inputs":[],"outputs":[]},
      {"id":"tt-customer-onboarding-3","skillId":"software-engineer","stageId":"setup","playbookId":"account-provisioning","notes":"","owners":["Forge (Eng copilot)"],"inputs":[],"outputs":[]},
      {"id":"tt-customer-onboarding-4","skillId":"customer-support-engineer","stageId":"setup","playbookId":"data-import","notes":"","owners":["Noor Hassan (Support Eng)"],"inputs":[],"outputs":[]},
      {"id":"tt-customer-onboarding-5","skillId":"customer-success-manager","stageId":"activation","playbookId":"activation-checklist","notes":"","checkpoint":true,"owners":["Priya Shah (CSM)"],"inputs":[],"outputs":[]},
      {"id":"tt-customer-onboarding-6","skillId":"customer-success-manager","stageId":"review","playbookId":"thirty-day-review","notes":"","owners":["Priya Shah (CSM)"],"inputs":[],"outputs":[]}
    ]'::jsonb),

  -- Customer Success Loop
  ('customer-success-loop','Customer Success Loop','#10b981',true,
    '[{"id":"health","label":"Health Check","sub":"Score"},{"id":"qbr","label":"QBR","sub":"Quarterly"},{"id":"expansion","label":"Expansion","sub":"Upsell"},{"id":"renewal","label":"Renewal","sub":"Lock"}]'::jsonb,
    '[{"id":"customer-success-manager","label":"Customer Success Manager","owners":["Priya Shah (CSM)"]},{"id":"account-executive","label":"Account Executive","owners":["Jordan Wu (AE)"]},{"id":"product-manager","label":"Product Manager","owners":["Maya Chen (Product Lead)"]}]'::jsonb,
    '[
      {"id":"tt-customer-success-loop-1","skillId":"customer-success-manager","stageId":"health","playbookId":"health-score","notes":"","owners":["Priya Shah (CSM)"],"inputs":[],"outputs":[]},
      {"id":"tt-customer-success-loop-2","skillId":"customer-success-manager","stageId":"qbr","playbookId":"qbr","notes":"","checkpoint":true,"owners":["Priya Shah (CSM)"],"inputs":[],"outputs":[]},
      {"id":"tt-customer-success-loop-3","skillId":"account-executive","stageId":"expansion","playbookId":"expansion-plan","notes":"","owners":["Jordan Wu (AE)","Priya Shah (CSM)"],"inputs":[],"outputs":[]},
      {"id":"tt-customer-success-loop-4","skillId":"customer-success-manager","stageId":"renewal","playbookId":"renewal-prep","notes":"","owners":["Priya Shah (CSM)"],"inputs":[],"outputs":[]},
      {"id":"tt-customer-success-loop-5","skillId":"customer-success-manager","stageId":"renewal","playbookId":"nps-pulse","notes":"","owners":["Priya Shah (CSM)"],"inputs":[],"outputs":[]}
    ]'::jsonb),

  -- Incident Response
  ('incident-response','Incident Response','#dc2626',true,
    '[{"id":"detect","label":"Detect","sub":"Alert"},{"id":"triage","label":"Triage","sub":"Severity"},{"id":"resolve","label":"Resolve","sub":"Fix"},{"id":"postmortem","label":"Postmortem","sub":"Learn"}]'::jsonb,
    '[{"id":"site-reliability-engineer","label":"Site Reliability Engineer","owners":["Kai Brennan (SRE)"]},{"id":"software-engineer","label":"Software Engineer","owners":["Diego Alvarez (Eng Lead)","Forge (Eng copilot)"]},{"id":"customer-support-engineer","label":"Customer Support Engineer","owners":["Noor Hassan (Support Eng)"]},{"id":"product-manager","label":"Product Manager","owners":["Maya Chen (Product Lead)"]}]'::jsonb,
    '[
      {"id":"tt-incident-response-1","skillId":"site-reliability-engineer","stageId":"triage","playbookId":"incident-triage","notes":"","owners":["Kai Brennan (SRE)"],"inputs":[],"outputs":[]},
      {"id":"tt-incident-response-2","skillId":"customer-support-engineer","stageId":"triage","playbookId":"customer-comms","notes":"Status page + targeted comms","owners":["Noor Hassan (Support Eng)"],"inputs":[],"outputs":[]},
      {"id":"tt-incident-response-3","skillId":"software-engineer","stageId":"resolve","playbookId":"incident-resolution","notes":"","checkpoint":true,"owners":["Diego Alvarez (Eng Lead)","Forge (Eng copilot)"],"inputs":[],"outputs":[]},
      {"id":"tt-incident-response-4","skillId":"product-manager","stageId":"postmortem","playbookId":"postmortem","notes":"","owners":["Maya Chen (Product Lead)"],"inputs":[],"outputs":[]},
      {"id":"tt-incident-response-5","skillId":"product-manager","stageId":"postmortem","playbookId":"release-notes","notes":"Customer-facing followup","owners":["Maya Chen (Product Lead)"],"inputs":[],"outputs":[]}
    ]'::jsonb),

  -- Hiring Loop
  ('hiring','Hiring Loop','#e11d48',true,
    '[{"id":"source","label":"Source","sub":"JD"},{"id":"screen","label":"Screen","sub":"Recruiter"},{"id":"interview","label":"Interview","sub":"Loop"},{"id":"offer","label":"Offer","sub":"Sign"},{"id":"onboard","label":"Onboard","sub":"Day 1"}]'::jsonb,
    '[{"id":"people-operations","label":"People Operations","owners":["Hana Reyes (People Ops)"]},{"id":"engineering-manager","label":"Engineering Manager","owners":["Diego Alvarez (Eng Lead)"]},{"id":"founder","label":"Founder / CEO","owners":["Andres Elizondo (Founder)"]}]'::jsonb,
    '[
      {"id":"tt-hiring-1","skillId":"people-operations","stageId":"source","playbookId":"role-jd","notes":"","owners":["Hana Reyes (People Ops)","Diego Alvarez (Eng Lead)"],"inputs":[],"outputs":[]},
      {"id":"tt-hiring-2","skillId":"people-operations","stageId":"screen","playbookId":"candidate-screen","notes":"","owners":["Hana Reyes (People Ops)"],"inputs":[],"outputs":[]},
      {"id":"tt-hiring-3","skillId":"engineering-manager","stageId":"interview","playbookId":"interview-loop","notes":"","checkpoint":true,"owners":["Diego Alvarez (Eng Lead)","Hana Reyes (People Ops)"],"inputs":[],"outputs":[]},
      {"id":"tt-hiring-4","skillId":"founder","stageId":"offer","playbookId":"offer-letter","notes":"","owners":["Andres Elizondo (Founder)","Hana Reyes (People Ops)"],"inputs":[],"outputs":[]},
      {"id":"tt-hiring-5","skillId":"people-operations","stageId":"onboard","playbookId":"new-hire-onboarding","notes":"","owners":["Hana Reyes (People Ops)"],"inputs":[],"outputs":[]},
      {"id":"tt-hiring-6","skillId":"engineering-manager","stageId":"onboard","playbookId":"sprint-planning","notes":"First sprint plan with new hire","owners":["Diego Alvarez (Eng Lead)"],"inputs":[],"outputs":[]}
    ]'::jsonb);

-- ---------------------------------------------------------------------------
-- Section 7b: snapshot playbook outputs/inputs into each task_templates entry.
-- Each entry's outputs[] is filled from the matching playbook's playbook_outputs;
-- inputs[] is filled from playbook_inputs. upstreamTaskRef wiring is set later
-- when materializing instance tasks (template-task lookup by playbookId there).
-- ---------------------------------------------------------------------------
update public.workflow_templates t
   set task_templates = (
     select jsonb_agg(
       (
         tt.value
         || jsonb_build_object(
              'outputs', coalesce(
                (
                  select jsonb_agg(
                    jsonb_build_object(
                      'id',          po.id,
                      'playbookId',  po.playbook_id,
                      'name',        po.name,
                      'description', po.description,
                      'kind',        po.kind,
                      'apiCheck',    po.api_check,
                      'position',    po.position,
                      'createdAt',   po.created_at
                    ) order by po.position asc
                  )
                  from public.playbook_outputs po
                  where po.playbook_id = tt.value->>'playbookId'
                ),
                '[]'::jsonb
              ),
              'inputs', coalesce(
                (
                  select jsonb_agg(
                    jsonb_build_object(
                      'id',               pi.id::text,
                      'upstreamOutputId', pi.upstream_output_id::text
                    ) order by pi.position asc
                  )
                  from public.playbook_inputs pi
                  where pi.playbook_id = tt.value->>'playbookId'
                ),
                '[]'::jsonb
              )
            )
       )
       order by tt.ord
     )
     from jsonb_array_elements(t.task_templates) with ordinality as tt(value, ord)
   )
 where jsonb_typeof(t.task_templates) = 'array'
   and jsonb_array_length(t.task_templates) > 0;


-- =============================================================================
-- Section 8: Example instances + tasks + IO state + events
--
-- Strategy: declare the instances + per-task status overrides in a temp
-- staging table, then materialize workflow_tasks from each instance's
-- template's task_templates in a single bulk INSERT. Produced task_outputs
-- fire the on_task_output_produced trigger which auto-creates the matching
-- downstream task_inputs.received=true rows.
-- =============================================================================

create temp table _instance_seed (
  instance_id      uuid          not null primary key,
  template_id      text          not null,
  label            text          not null,
  instance_status  text          not null,
  task_overrides   jsonb         not null default '{}'::jsonb
) on commit drop;

-- Instance UUIDs are deterministic so cross-section references stay stable.
insert into _instance_seed values
  -- ---- Strategy & OKRs (1 instance) -------------------------------------------------
  ('00000000-0000-4000-8000-000000000101'::uuid, 'strategy-okrs',
   'Strategy & OKRs — 2026 Q2 OKRs', 'active',
   '{
     "tt-strategy-okrs-1":{"status":"complete"},
     "tt-strategy-okrs-2":{"status":"complete"},
     "tt-strategy-okrs-3":{"status":"in_progress"},
     "tt-strategy-okrs-4":{"status":"paused","paused_reason":"checkpoint"},
     "tt-strategy-okrs-5":{"status":"not_started"}
   }'::jsonb),
  -- ---- Product Discovery (1) --------------------------------------------------------
  ('00000000-0000-4000-8000-000000000201'::uuid, 'product-discovery',
   'Product Discovery — Multi-workspace permissions', 'active',
   '{
     "tt-product-discovery-1":{"status":"complete"},
     "tt-product-discovery-2":{"status":"complete"},
     "tt-product-discovery-3":{"status":"in_progress"},
     "tt-product-discovery-4":{"status":"waiting"},
     "tt-product-discovery-5":{"status":"not_started"}
   }'::jsonb),
  -- ---- Product Sprint (2 — multi_instance) ------------------------------------------
  ('00000000-0000-4000-8000-000000000301'::uuid, 'product-sprint',
   'Sprint 14 — Inputs & Outputs polish', 'active',
   '{
     "tt-product-sprint-1":{"status":"complete"},
     "tt-product-sprint-2":{"status":"complete"},
     "tt-product-sprint-3":{"status":"complete"},
     "tt-product-sprint-4":{"status":"in_progress"},
     "tt-product-sprint-5":{"status":"waiting"},
     "tt-product-sprint-6":{"status":"not_started"},
     "tt-product-sprint-7":{"status":"not_started"},
     "tt-product-sprint-8":{"status":"not_started"}
   }'::jsonb),
  ('00000000-0000-4000-8000-000000000302'::uuid, 'product-sprint',
   'Sprint 13 — Onboarding email overhaul', 'complete',
   '{
     "tt-product-sprint-1":{"status":"complete"},
     "tt-product-sprint-2":{"status":"complete"},
     "tt-product-sprint-3":{"status":"complete"},
     "tt-product-sprint-4":{"status":"complete"},
     "tt-product-sprint-5":{"status":"complete"},
     "tt-product-sprint-6":{"status":"complete"},
     "tt-product-sprint-7":{"status":"complete"},
     "tt-product-sprint-8":{"status":"complete"}
   }'::jsonb),
  -- ---- Design System Evolution (1) --------------------------------------------------
  ('00000000-0000-4000-8000-000000000401'::uuid, 'design-system',
   'Design System Evolution — Q2 component refresh', 'active',
   '{
     "tt-design-system-1":{"status":"complete"},
     "tt-design-system-2":{"status":"paused","paused_reason":"checkpoint"},
     "tt-design-system-3":{"status":"waiting"},
     "tt-design-system-4":{"status":"not_started"}
   }'::jsonb),
  -- ---- Product Launch (1) -----------------------------------------------------------
  ('00000000-0000-4000-8000-000000000501'::uuid, 'launch',
   'Product Launch — Inputs & Outputs GA launch', 'active',
   '{
     "tt-launch-1":{"status":"complete"},
     "tt-launch-2":{"status":"complete"},
     "tt-launch-3":{"status":"in_progress"},
     "tt-launch-4":{"status":"in_progress"},
     "tt-launch-5":{"status":"not_started"},
     "tt-launch-6":{"status":"not_started"},
     "tt-launch-7":{"status":"not_started"}
   }'::jsonb),
  -- ---- Sales Cycle (4 — multi_instance) --------------------------------------------
  ('00000000-0000-4000-8000-000000000601'::uuid, 'sales-cycle',
   'Sales Cycle — Acme Robotics (Series B)', 'complete',
   '{
     "tt-sales-cycle-1":{"status":"complete"},
     "tt-sales-cycle-2":{"status":"complete"},
     "tt-sales-cycle-3":{"status":"complete"},
     "tt-sales-cycle-4":{"status":"complete"},
     "tt-sales-cycle-5":{"status":"complete"},
     "tt-sales-cycle-6":{"status":"complete"},
     "tt-sales-cycle-7":{"status":"complete"}
   }'::jsonb),
  ('00000000-0000-4000-8000-000000000602'::uuid, 'sales-cycle',
   'Sales Cycle — Northwind Labs', 'active',
   '{
     "tt-sales-cycle-1":{"status":"complete"},
     "tt-sales-cycle-2":{"status":"complete"},
     "tt-sales-cycle-3":{"status":"complete"},
     "tt-sales-cycle-4":{"status":"complete"},
     "tt-sales-cycle-5":{"status":"paused","paused_reason":"checkpoint"},
     "tt-sales-cycle-6":{"status":"not_started"},
     "tt-sales-cycle-7":{"status":"not_started"}
   }'::jsonb),
  ('00000000-0000-4000-8000-000000000603'::uuid, 'sales-cycle',
   'Sales Cycle — Brightline AI', 'active',
   '{
     "tt-sales-cycle-1":{"status":"complete"},
     "tt-sales-cycle-2":{"status":"in_progress"},
     "tt-sales-cycle-3":{"status":"in_progress"},
     "tt-sales-cycle-4":{"status":"not_started"},
     "tt-sales-cycle-5":{"status":"not_started"},
     "tt-sales-cycle-6":{"status":"not_started"},
     "tt-sales-cycle-7":{"status":"not_started"}
   }'::jsonb),
  ('00000000-0000-4000-8000-000000000604'::uuid, 'sales-cycle',
   'Sales Cycle — Helio Health', 'not_started',
   '{}'::jsonb),
  -- ---- Customer Onboarding (3) -----------------------------------------------------
  ('00000000-0000-4000-8000-000000000701'::uuid, 'customer-onboarding',
   'Customer Onboarding — Loomstack', 'complete',
   '{
     "tt-customer-onboarding-1":{"status":"complete"},
     "tt-customer-onboarding-2":{"status":"complete"},
     "tt-customer-onboarding-3":{"status":"complete"},
     "tt-customer-onboarding-4":{"status":"complete"},
     "tt-customer-onboarding-5":{"status":"complete"},
     "tt-customer-onboarding-6":{"status":"complete"}
   }'::jsonb),
  ('00000000-0000-4000-8000-000000000702'::uuid, 'customer-onboarding',
   'Customer Onboarding — Fernpath', 'active',
   '{
     "tt-customer-onboarding-1":{"status":"complete"},
     "tt-customer-onboarding-2":{"status":"complete"},
     "tt-customer-onboarding-3":{"status":"complete"},
     "tt-customer-onboarding-4":{"status":"in_progress"},
     "tt-customer-onboarding-5":{"status":"waiting"},
     "tt-customer-onboarding-6":{"status":"not_started"}
   }'::jsonb),
  ('00000000-0000-4000-8000-000000000703'::uuid, 'customer-onboarding',
   'Customer Onboarding — Acme Robotics', 'not_started',
   '{}'::jsonb),
  -- ---- Customer Success Loop (3) ---------------------------------------------------
  ('00000000-0000-4000-8000-000000000801'::uuid, 'customer-success-loop',
   'Customer Success Loop — Loomstack Q2 QBR', 'complete',
   '{
     "tt-customer-success-loop-1":{"status":"complete"},
     "tt-customer-success-loop-2":{"status":"complete"},
     "tt-customer-success-loop-3":{"status":"complete"},
     "tt-customer-success-loop-4":{"status":"complete"},
     "tt-customer-success-loop-5":{"status":"complete"}
   }'::jsonb),
  ('00000000-0000-4000-8000-000000000802'::uuid, 'customer-success-loop',
   'Customer Success Loop — Fernpath renewal', 'active',
   '{
     "tt-customer-success-loop-1":{"status":"complete"},
     "tt-customer-success-loop-2":{"status":"complete"},
     "tt-customer-success-loop-3":{"status":"not_started"},
     "tt-customer-success-loop-4":{"status":"in_progress"},
     "tt-customer-success-loop-5":{"status":"not_started"}
   }'::jsonb),
  ('00000000-0000-4000-8000-000000000803'::uuid, 'customer-success-loop',
   'Customer Success Loop — Acme Robotics expansion', 'active',
   '{
     "tt-customer-success-loop-1":{"status":"complete"},
     "tt-customer-success-loop-2":{"status":"paused","paused_reason":"checkpoint"},
     "tt-customer-success-loop-3":{"status":"waiting"},
     "tt-customer-success-loop-4":{"status":"not_started"},
     "tt-customer-success-loop-5":{"status":"not_started"}
   }'::jsonb),
  -- ---- Incident Response (3) -------------------------------------------------------
  ('00000000-0000-4000-8000-000000000901'::uuid, 'incident-response',
   'Incident Response — Webhook delivery degradation (May 18)', 'complete',
   '{
     "tt-incident-response-1":{"status":"complete"},
     "tt-incident-response-2":{"status":"complete"},
     "tt-incident-response-3":{"status":"complete"},
     "tt-incident-response-4":{"status":"complete"},
     "tt-incident-response-5":{"status":"complete"}
   }'::jsonb),
  ('00000000-0000-4000-8000-000000000902'::uuid, 'incident-response',
   'Incident Response — Onboarding email bounce spike', 'active',
   '{
     "tt-incident-response-1":{"status":"complete"},
     "tt-incident-response-2":{"status":"complete"},
     "tt-incident-response-3":{"status":"in_progress"},
     "tt-incident-response-4":{"status":"not_started"},
     "tt-incident-response-5":{"status":"not_started"}
   }'::jsonb),
  ('00000000-0000-4000-8000-000000000903'::uuid, 'incident-response',
   'Incident Response — Search latency uptick', 'not_started',
   '{}'::jsonb),
  -- ---- Hiring (3) ------------------------------------------------------------------
  ('00000000-0000-4000-8000-000000000a01'::uuid, 'hiring',
   'Hiring — Senior Software Engineer', 'active',
   '{
     "tt-hiring-1":{"status":"complete"},
     "tt-hiring-2":{"status":"complete"},
     "tt-hiring-3":{"status":"in_progress"},
     "tt-hiring-4":{"status":"not_started"},
     "tt-hiring-5":{"status":"not_started"},
     "tt-hiring-6":{"status":"not_started"}
   }'::jsonb),
  ('00000000-0000-4000-8000-000000000a02'::uuid, 'hiring',
   'Hiring — Product Designer', 'active',
   '{
     "tt-hiring-1":{"status":"complete"},
     "tt-hiring-2":{"status":"in_progress"},
     "tt-hiring-3":{"status":"not_started"},
     "tt-hiring-4":{"status":"not_started"},
     "tt-hiring-5":{"status":"not_started"},
     "tt-hiring-6":{"status":"not_started"}
   }'::jsonb),
  ('00000000-0000-4000-8000-000000000a03'::uuid, 'hiring',
   'Hiring — Customer Success Manager', 'active',
   '{
     "tt-hiring-1":{"status":"complete"},
     "tt-hiring-2":{"status":"paused","paused_reason":"checkpoint"},
     "tt-hiring-3":{"status":"not_started"},
     "tt-hiring-4":{"status":"not_started"},
     "tt-hiring-5":{"status":"not_started"},
     "tt-hiring-6":{"status":"not_started"}
   }'::jsonb);

-- ---- 8a: Insert instances (skills + stages snapshotted from template) -------
insert into public.workflow_instances (id, template_id, label, status, skills, stages, template_synced_at)
select s.instance_id, s.template_id, s.label, s.instance_status, t.skills, t.stages, now()
  from _instance_seed s
  join public.workflow_templates t on t.id = s.template_id;

-- ---- 8b: Materialize workflow_tasks from each template's task_templates -----
insert into public.workflow_tasks (
  instance_id, template_task_id, skill_id, stage_id, notes, status, substatus,
  checkpoint, inputs, outputs, playbook_id, owners,
  paused_reason, paused_by, paused_at
)
select
  s.instance_id,
  tt.value->>'id',
  tt.value->>'skillId',
  tt.value->>'stageId',
  coalesce(tt.value->>'notes', ''),
  coalesce(s.task_overrides -> (tt.value->>'id') ->> 'status', 'not_started'),
  '',
  coalesce((tt.value->>'checkpoint')::boolean, false),
  coalesce(tt.value->'inputs', '[]'::jsonb),
  coalesce(tt.value->'outputs', '[]'::jsonb),
  nullif(tt.value->>'playbookId', ''),
  coalesce(tt.value->'owners', '[]'::jsonb),
  s.task_overrides -> (tt.value->>'id') ->> 'paused_reason',
  case
    when (s.task_overrides -> (tt.value->>'id') ->> 'status') = 'paused'
      then 'Maya Chen (Product Lead)'
    else null
  end,
  case
    when (s.task_overrides -> (tt.value->>'id') ->> 'status') = 'paused'
      then now() - interval '4 hours'
    else null
  end
from _instance_seed s
join public.workflow_templates t on t.id = s.template_id
cross join lateral jsonb_array_elements(t.task_templates) as tt(value);

-- ---- 8c: Produce a representative set of task_outputs --------------------------
-- Each row selects (task, output) by (instance_id, template_task_id, output_name);
-- the on_task_output_produced trigger fires and creates task_inputs(received=true)
-- on every downstream task whose snapshotted inputs[].upstreamOutputId matches.
-- Only outputs on already-`complete` or `in_progress` tasks should be produced.

with produce_spec(instance_id, template_task_id, output_name, artifact_url, produced_by) as (
  values
    -- Strategy & OKRs
    ('00000000-0000-4000-8000-000000000101'::uuid, 'tt-strategy-okrs-1', 'Problem Brief',
       'https://docs.productled.co/strategy/q2/problem-brief',     'Andres Elizondo (Founder)'),
    ('00000000-0000-4000-8000-000000000101'::uuid, 'tt-strategy-okrs-2', 'Research Memo',
       'https://docs.productled.co/strategy/q2/market-memo',       'Lumen (Research copilot)'),
    -- Product Discovery
    ('00000000-0000-4000-8000-000000000201'::uuid, 'tt-product-discovery-1', 'Problem Brief',
       'https://docs.productled.co/discovery/multi-workspace/problem', 'Maya Chen (Product Lead)'),
    ('00000000-0000-4000-8000-000000000201'::uuid, 'tt-product-discovery-2', 'Interview Notes',
       'https://docs.productled.co/discovery/multi-workspace/interviews', 'Lumen (Research copilot)'),
    ('00000000-0000-4000-8000-000000000201'::uuid, 'tt-product-discovery-2', 'Insight Synthesis',
       'https://docs.productled.co/discovery/multi-workspace/synthesis', 'Lumen (Research copilot)'),
    -- Product Sprint — Sprint 14 (active)
    ('00000000-0000-4000-8000-000000000301'::uuid, 'tt-product-sprint-1', 'Sprint Goal',
       'Sprint 14 goal: ship Inputs & Outputs polish across all surfaces', 'Diego Alvarez (Eng Lead)'),
    ('00000000-0000-4000-8000-000000000301'::uuid, 'tt-product-sprint-2', 'Spec Doc',
       'https://github.com/productled-co/app/blob/main/spec/inputs-outputs.yaml', 'Atlas (PM copilot)'),
    ('00000000-0000-4000-8000-000000000301'::uuid, 'tt-product-sprint-3', 'Figma Link',
       'https://www.figma.com/file/abcd1234/Sprint-14-IO-polish', 'Pixel (Design copilot)'),
    -- Product Sprint — Sprint 13 (complete) — produce all
    ('00000000-0000-4000-8000-000000000302'::uuid, 'tt-product-sprint-1', 'Sprint Goal',
       'Sprint 13 goal: rewrite onboarding email sequence',              'Diego Alvarez (Eng Lead)'),
    ('00000000-0000-4000-8000-000000000302'::uuid, 'tt-product-sprint-2', 'Spec Doc',
       'https://github.com/productled-co/app/blob/main/spec/onboarding-emails.yaml', 'Atlas (PM copilot)'),
    ('00000000-0000-4000-8000-000000000302'::uuid, 'tt-product-sprint-3', 'Figma Link',
       'https://www.figma.com/file/efgh5678/Sprint-13-Onboarding-emails', 'Pixel (Design copilot)'),
    ('00000000-0000-4000-8000-000000000302'::uuid, 'tt-product-sprint-4', 'PR Link',
       'https://github.com/productled-co/app/pull/142',                  'Forge (Eng copilot)'),
    ('00000000-0000-4000-8000-000000000302'::uuid, 'tt-product-sprint-4', 'Staging URL',
       'https://staging.productled.co/onboarding/emails',                'Forge (Eng copilot)'),
    -- Design System Evolution
    ('00000000-0000-4000-8000-000000000401'::uuid, 'tt-design-system-1', 'Audit Memo',
       'https://docs.productled.co/design-system/q2/audit',              'Riya Patel (Sr. Designer)'),
    -- Product Launch
    ('00000000-0000-4000-8000-000000000501'::uuid, 'tt-launch-1', 'ICP Doc',
       'https://docs.productled.co/launch/io/icp',                       'Sam Okafor (DevRel/PMM)'),
    ('00000000-0000-4000-8000-000000000501'::uuid, 'tt-launch-2', 'Messaging Doc',
       'https://docs.productled.co/launch/io/messaging-house',           'Sam Okafor (DevRel/PMM)'),
    -- Sales Cycle — Acme (complete) — produce all
    ('00000000-0000-4000-8000-000000000601'::uuid, 'tt-sales-cycle-1', 'Prospect List',
       'https://docs.productled.co/sales/acme/prospect-list',            'Vega (Growth copilot)'),
    ('00000000-0000-4000-8000-000000000601'::uuid, 'tt-sales-cycle-3', 'Discovery Notes',
       'Acme series B; champion = VP Eng; budget signed off; pain = manual handoffs', 'Jordan Wu (AE)'),
    ('00000000-0000-4000-8000-000000000601'::uuid, 'tt-sales-cycle-5', 'Proposal PDF',
       'https://docs.productled.co/sales/acme/proposal.pdf',             'Jordan Wu (AE)'),
    ('00000000-0000-4000-8000-000000000601'::uuid, 'tt-sales-cycle-6', 'Signed Contract',
       'https://docs.productled.co/sales/acme/msa-signed.pdf',           'Theo Nakamura (FinOps)'),
    ('00000000-0000-4000-8000-000000000601'::uuid, 'tt-sales-cycle-7', 'Handoff Doc',
       'https://docs.productled.co/sales/acme/cs-handoff',               'Priya Shah (CSM)'),
    -- Sales Cycle — Northwind (active, mid-negotiation)
    ('00000000-0000-4000-8000-000000000602'::uuid, 'tt-sales-cycle-3', 'Discovery Notes',
       'Northwind pilot scope confirmed; legal pending', 'Jordan Wu (AE)'),
    -- Customer Onboarding — Loomstack (complete) — produce a few key ones
    ('00000000-0000-4000-8000-000000000701'::uuid, 'tt-customer-onboarding-2', 'Success Criteria Doc',
       'https://docs.productled.co/customers/loomstack/success-criteria','Priya Shah (CSM)'),
    ('00000000-0000-4000-8000-000000000701'::uuid, 'tt-customer-onboarding-6', 'Review Memo',
       'https://docs.productled.co/customers/loomstack/30-day-review',   'Priya Shah (CSM)'),
    -- Customer Onboarding — Fernpath (active)
    ('00000000-0000-4000-8000-000000000702'::uuid, 'tt-customer-onboarding-2', 'Success Criteria Doc',
       'https://docs.productled.co/customers/fernpath/success-criteria', 'Priya Shah (CSM)'),
    -- Customer Success Loop — Loomstack Q2 QBR (complete)
    ('00000000-0000-4000-8000-000000000801'::uuid, 'tt-customer-success-loop-1', 'Account Health Score',
       'Loomstack health: Green (85)', 'Priya Shah (CSM)'),
    ('00000000-0000-4000-8000-000000000801'::uuid, 'tt-customer-success-loop-2', 'QBR Deck',
       'https://docs.productled.co/customers/loomstack/q2-qbr.pdf', 'Priya Shah (CSM)'),
    -- Customer Success Loop — Acme expansion (active, paused at QBR checkpoint)
    ('00000000-0000-4000-8000-000000000803'::uuid, 'tt-customer-success-loop-1', 'Account Health Score',
       'Acme health: Yellow (72) — adoption plateau', 'Priya Shah (CSM)'),
    -- Incident Response — Webhook degradation (complete)
    ('00000000-0000-4000-8000-000000000901'::uuid, 'tt-incident-response-1', 'Triage Summary',
       'P1 — webhook delivery dropped 18% between 14:00-14:42 UTC; IC: Kai Brennan', 'Kai Brennan (SRE)'),
    ('00000000-0000-4000-8000-000000000901'::uuid, 'tt-incident-response-3', 'Fix PR',
       'https://github.com/productled-co/app/pull/156', 'Forge (Eng copilot)'),
    ('00000000-0000-4000-8000-000000000901'::uuid, 'tt-incident-response-3', 'Deploy Confirmation',
       'Deployed at 16:12 UTC; webhook success rate back to 99.97%', 'Kai Brennan (SRE)'),
    ('00000000-0000-4000-8000-000000000901'::uuid, 'tt-incident-response-4', 'Postmortem Doc',
       'https://docs.productled.co/postmortems/webhook-2026-05-18', 'Maya Chen (Product Lead)'),
    -- Incident Response — Onboarding email bounce spike (active)
    ('00000000-0000-4000-8000-000000000902'::uuid, 'tt-incident-response-1', 'Triage Summary',
       'P2 — email bounce rate at 4.1% (baseline 0.6%); SendGrid IP warmup suspect', 'Kai Brennan (SRE)'),
    -- Hiring — Senior SWE (active)
    ('00000000-0000-4000-8000-000000000a01'::uuid, 'tt-hiring-1', 'Published JD',
       'https://productled.co/careers/senior-software-engineer', 'Hana Reyes (People Ops)'),
    ('00000000-0000-4000-8000-000000000a01'::uuid, 'tt-hiring-2', 'Screen Notes',
       'https://docs.productled.co/hiring/senior-swe/screens', 'Hana Reyes (People Ops)'),
    -- Hiring — Product Designer
    ('00000000-0000-4000-8000-000000000a02'::uuid, 'tt-hiring-1', 'Published JD',
       'https://productled.co/careers/product-designer', 'Hana Reyes (People Ops)'),
    -- Hiring — CSM
    ('00000000-0000-4000-8000-000000000a03'::uuid, 'tt-hiring-1', 'Published JD',
       'https://productled.co/careers/customer-success-manager', 'Hana Reyes (People Ops)')
)
insert into public.task_outputs (task_id, output_id, status, artifact_url, produced_by, produced_at)
select t.id, (output_elem->>'id')::uuid, 'produced', p.artifact_url, p.produced_by, now() - interval '1 day'
  from produce_spec p
  join public.workflow_tasks t
    on t.instance_id = p.instance_id and t.template_task_id = p.template_task_id
  cross join lateral jsonb_array_elements(t.outputs) as output_elem
 where output_elem->>'name' = p.output_name;

-- ---- 8d: Workflow events (event feed) -------------------------------------------
-- A handful of recent events per active/complete instance so /events looks alive.
insert into public.workflow_events (instance_id, task_id, name, description, payload, created_at)
select s.instance_id, t.id, e.name, e.description, e.payload, now() - e.ago
  from (values
    -- Sprint 14
    ('00000000-0000-4000-8000-000000000301'::uuid, 'tt-product-sprint-3', 'workflow.task_completed',
       'Design handoff approved', '{"checkpoint":"design_review"}'::jsonb, interval '6 hours'),
    ('00000000-0000-4000-8000-000000000301'::uuid, 'tt-product-sprint-4', 'workflow.task_started',
       'Engineering build kicked off', '{}'::jsonb, interval '5 hours'),
    -- Sprint 13 (complete)
    ('00000000-0000-4000-8000-000000000302'::uuid, 'tt-product-sprint-7', 'workflow.task_completed',
       'Release notes published', '{"url":"https://productled.co/changelog/onboarding-emails"}'::jsonb, interval '2 days'),
    -- Webhook incident
    ('00000000-0000-4000-8000-000000000901'::uuid, 'tt-incident-response-1', 'workflow.task_started',
       'Incident triaged at P1', '{"severity":"P1"}'::jsonb, interval '8 days'),
    ('00000000-0000-4000-8000-000000000901'::uuid, 'tt-incident-response-3', 'workflow.task_completed',
       'Fix deployed', '{"deploy_id":"deploy_2026_05_18_16_12"}'::jsonb, interval '8 days'),
    ('00000000-0000-4000-8000-000000000901'::uuid, 'tt-incident-response-4', 'workflow.task_completed',
       'Postmortem published', '{}'::jsonb, interval '6 days'),
    -- Acme close
    ('00000000-0000-4000-8000-000000000601'::uuid, 'tt-sales-cycle-6', 'workflow.task_completed',
       'Acme Robotics contract signed', '{"acv_usd":120000}'::jsonb, interval '14 days'),
    ('00000000-0000-4000-8000-000000000601'::uuid, 'tt-sales-cycle-7', 'workflow.task_completed',
       'CS handoff complete', '{}'::jsonb, interval '13 days'),
    -- Northwind paused at proposal
    ('00000000-0000-4000-8000-000000000602'::uuid, 'tt-sales-cycle-5', 'workflow.checkpoint_reached',
       'Northwind proposal awaiting legal review', '{"checkpoint":"legal"}'::jsonb, interval '3 days'),
    -- Loomstack QBR
    ('00000000-0000-4000-8000-000000000801'::uuid, 'tt-customer-success-loop-2', 'workflow.task_completed',
       'Loomstack Q2 QBR delivered', '{"health":"green"}'::jsonb, interval '5 days'),
    -- Acme expansion paused at QBR checkpoint
    ('00000000-0000-4000-8000-000000000803'::uuid, 'tt-customer-success-loop-2', 'workflow.checkpoint_reached',
       'Acme QBR awaiting customer scheduling', '{"checkpoint":"customer_availability"}'::jsonb, interval '2 days'),
    -- Hiring loops
    ('00000000-0000-4000-8000-000000000a01'::uuid, 'tt-hiring-3', 'workflow.task_started',
       'Senior SWE interview loop started', '{"candidate":"anonymous_candidate_1"}'::jsonb, interval '4 days'),
    ('00000000-0000-4000-8000-000000000a03'::uuid, 'tt-hiring-2', 'workflow.checkpoint_reached',
       'CSM hiring paused at recruiter screen for hiring committee', '{}'::jsonb, interval '1 day'),
    -- Strategy & OKRs checkpoint
    ('00000000-0000-4000-8000-000000000101'::uuid, 'tt-strategy-okrs-4', 'workflow.checkpoint_reached',
       'Q2 OKRs awaiting founder signoff', '{}'::jsonb, interval '7 hours'),
    -- Discovery progress
    ('00000000-0000-4000-8000-000000000201'::uuid, 'tt-product-discovery-2', 'workflow.task_completed',
       'Discovery interviews synthesized (n=6)', '{"interviews":6}'::jsonb, interval '2 days'),
    -- Launch active
    ('00000000-0000-4000-8000-000000000501'::uuid, 'tt-launch-2', 'workflow.task_completed',
       'Messaging house signed off', '{}'::jsonb, interval '3 days'),
    ('00000000-0000-4000-8000-000000000501'::uuid, 'tt-launch-3', 'workflow.task_started',
       'Landing page build started', '{}'::jsonb, interval '2 days'),
    -- Fernpath onboarding
    ('00000000-0000-4000-8000-000000000702'::uuid, 'tt-customer-onboarding-4', 'workflow.task_started',
       'Fernpath data import in progress', '{}'::jsonb, interval '6 hours')
  ) as e(instance_id, template_task_id, name, description, payload, ago)
  join _instance_seed s on s.instance_id = e.instance_id
  join public.workflow_tasks t
    on t.instance_id = e.instance_id and t.template_task_id = e.template_task_id;

commit;

-- =============================================================================
-- End of ProductLed Co seed.
-- =============================================================================
