-- Seed migration for the four canonical workflow templates and the founder
-- Skills/Playbooks library used by the dashboard mock data.
--
-- Source files (design handoff, kept under /tmp/design-canvas):
--   * `Process Canvas v2/data.js` -> updated stages/roles/icons for the four
--     templates and the canonical CompanyX task list used to derive the
--     Client Project Delivery `task_templates` (per AEL-47 + TransportBand01).
--   * `pc-components.jsx` -> `FRAMEWORK_ITEMS_DEFAULT` (Skills + Playbooks)
--     and `taskTemplates` for Product Development / Go-to-Market / Operations.
--
-- This migration is idempotent (`on conflict ... do update`) so re-running it
-- against an existing dev database refreshes the seed in place.

-- ---------------------------------------------------------------------------
-- Workflow templates
-- ---------------------------------------------------------------------------
insert into public.workflow_templates (id, label, color, multi_instance, stages, roles, task_templates)
values
  -- Client Project Delivery (TransportBand01-aligned: 8 stages, 7 roles).
  -- task_templates derived from the CompanyX instance tasks in v2 data.js:
  -- triggers reference upstream task titles (taskRef) rather than instance ids.
  (
    'client-delivery',
    'Client Project Delivery',
    '#6366f1',
    true,
    '[
      {"id":"pre-sales","label":"Pre-Sales","sub":"Customer"},
      {"id":"validation","label":"Validation","sub":"PDR"},
      {"id":"ready","label":"Ready","sub":"Received PO"},
      {"id":"planning","label":"Planning","sub":"Project"},
      {"id":"in-dev","label":"In Development","sub":"Product Launch"},
      {"id":"deployment","label":"Deployment","sub":"Installation"},
      {"id":"closure","label":"Closure","sub":"Confirmation"},
      {"id":"delivered","label":"Delivered","sub":"Done"}
    ]'::jsonb,
    '[
      {"id":"sales","label":"Sales","owner":"Hans / Dave"},
      {"id":"product","label":"Product","owner":"Andres / Dechaun"},
      {"id":"finance","label":"Finance","owner":"Joanna"},
      {"id":"project","label":"Project","owner":"Patrick"},
      {"id":"dev","label":"Development","owner":"Noah / Dev Team"},
      {"id":"marketing","label":"Marketing","owner":"Cristina"},
      {"id":"infra","label":"Support / Infra","owner":"Robert"}
    ]'::jsonb,
    '[
      {"role":"sales","stage":"pre-sales","title":"Project Description","desc":"Define objective, identify PDR need","agent":"Sales Ops","skill":"sales-ops","playbook":"presales-qualification","triggers":[{"type":"manual","label":"Manual start"}],"gates":[{"type":"playbook_done","label":"Agent completes playbook"}]},
      {"role":"sales","stage":"ready","title":"FO & TO Confirmation","desc":"Functional and technical description confirmation","agent":"Sales Ops","skill":"sales-ops","playbook":"fo-to-confirmation","triggers":[{"type":"after_task","taskRef":"PDR Review","label":"After PDR Review"}],"gates":[{"type":"playbook_done","label":"Agent completes playbook"}]},
      {"role":"sales","stage":"planning","title":"Update Business Model","desc":"Update pricebook, article numbers, Navision","agent":"Sales Ops","skill":"sales-ops","playbook":"business-model-update","triggers":[{"type":"after_task","taskRef":"Project Scope & Planning","label":"After Project Scope & Planning"}],"gates":[{"type":"checkpoint","label":"Human review required"}]},
      {"role":"sales","stage":"delivered","title":"Account Management","desc":"Cross/upselling, renewal opportunities","agent":"Sales Ops","skill":"sales-ops","playbook":"account-management","triggers":[{"type":"after_task","taskRef":"Project Delivery Confirmation","label":"After Project Delivery Confirmation"}],"gates":[{"type":"manual","label":"Human initiates"}]},
      {"role":"product","stage":"validation","title":"PDR Review","desc":"Evaluate, accept or reject, offer to customer","agent":"PM","skill":"pm","playbook":"pdr-review","triggers":[{"type":"after_task","taskRef":"Project Description","label":"After Project Description"}],"gates":[{"type":"checkpoint","label":"Human approval required"}]},
      {"role":"product","stage":"planning","title":"Roadmap Estimation","desc":"Capacity & prioritization for this project","agent":"PM","skill":"pm","playbook":"roadmap-estimation","triggers":[{"type":"after_task","taskRef":"PDR Review","label":"After PDR Review"}],"gates":[{"type":"playbook_done","label":"Agent completes playbook"}]},
      {"role":"product","stage":"in-dev","title":"Backlog Refinement","desc":"Feature grooming & sprint support","agent":"PM","skill":"pm","playbook":"backlog-refinement","checkpoint":true,"triggers":[{"type":"after_task","taskRef":"Project Scope & Planning","label":"After Project Scope & Planning"},{"type":"after_task","taskRef":"Register Quote","label":"After Register Quote"}],"gates":[{"type":"checkpoint","label":"Human approval to start sprint"}]},
      {"role":"product","stage":"delivered","title":"Usage Metrics","desc":"Platform metrics & feature usage reporting","agent":"PM","skill":"pm","playbook":"usage-metrics","triggers":[{"type":"after_task","taskRef":"Project Delivery Confirmation","label":"After Project Delivery Confirmation"}],"gates":[{"type":"playbook_done","label":"Agent completes playbook"}]},
      {"role":"finance","stage":"ready","title":"Initial Invoicing","desc":"Send initial invoice (usually 50%)","agent":"Finance Ops","skill":"finance-ops","playbook":"initial-invoicing","triggers":[{"type":"after_task","taskRef":"FO & TO Confirmation","label":"After FO & TO Confirmation"}],"gates":[{"type":"playbook_done","label":"Agent sends invoice"}]},
      {"role":"finance","stage":"ready","title":"Project Confirmation","desc":"PO confirmation, project start authorization","agent":"Finance Ops","skill":"finance-ops","playbook":"project-confirmation","triggers":[{"type":"after_task","taskRef":"Initial Invoicing","label":"After Initial Invoicing"}],"gates":[{"type":"checkpoint","label":"Human confirms PO received"}]},
      {"role":"finance","stage":"planning","title":"Register Quote","desc":"Quote added to Exact, linked to project","agent":"Finance Ops","skill":"finance-ops","playbook":"register-quote","triggers":[{"type":"after_task","taskRef":"Project Confirmation","label":"After Project Confirmation"}],"gates":[{"type":"playbook_done","label":"Agent completes entry"}]},
      {"role":"finance","stage":"deployment","title":"SLA Invoicing","desc":"Send invoice upon delivery (when applicable)","agent":"Finance Ops","skill":"finance-ops","playbook":"sla-invoicing","triggers":[{"type":"after_task","taskRef":"Acceptation","label":"After Acceptation"}],"gates":[{"type":"playbook_done","label":"Agent sends invoice"}]},
      {"role":"finance","stage":"closure","title":"Final Invoicing","desc":"Send final invoice & close financially","agent":"Finance Ops","skill":"finance-ops","playbook":"final-invoicing","triggers":[{"type":"after_task","taskRef":"Project Delivery Confirmation","label":"After Project Delivery Confirmation"}],"gates":[{"type":"checkpoint","label":"Human confirms invoice sent"}]},
      {"role":"project","stage":"planning","title":"Project Scope & Planning","desc":"Timeline, phases, dependencies, customer alignment","agent":"Project Mgr","skill":"project","playbook":"project-planning","triggers":[{"type":"after_task","taskRef":"Project Confirmation","label":"After Project Confirmation"}],"gates":[{"type":"checkpoint","label":"Human reviews plan"}]},
      {"role":"project","stage":"deployment","title":"Acceptation","desc":"Testing & feedback loop with customer","agent":"Project Mgr","skill":"project","playbook":"acceptation","triggers":[{"type":"after_task","taskRef":"Software Release","label":"After Software Release"}],"gates":[{"type":"checkpoint","label":"Customer sign-off required"}]},
      {"role":"project","stage":"deployment","title":"Production Rollout","desc":"End-user onboarding, go-live coordination","agent":"Project Mgr","skill":"project","playbook":"production-rollout","triggers":[{"type":"after_task","taskRef":"Acceptation","label":"After Acceptation"}],"gates":[{"type":"checkpoint","label":"Human approves go-live"}]},
      {"role":"project","stage":"closure","title":"Project Delivery Confirmation","desc":"Validate completion, no pending items","agent":"Project Mgr","skill":"project","playbook":"delivery-confirmation","triggers":[{"type":"after_task","taskRef":"Production Rollout","label":"After Production Rollout"},{"type":"after_task","taskRef":"Setup & License","label":"After Setup & License"}],"gates":[{"type":"checkpoint","label":"Human final sign-off"}]},
      {"role":"project","stage":"delivered","title":"Customer Relationship","desc":"Follow up, future planning, maintenance coordination","agent":"Project Mgr","skill":"project","playbook":"customer-relationship","triggers":[{"type":"after_task","taskRef":"Project Delivery Confirmation","label":"After Project Delivery Confirmation"}],"gates":[{"type":"manual","label":"Ongoing — human managed"}]},
      {"role":"dev","stage":"in-dev","title":"Software Release","desc":"Epics, stories, development, hotfixes, QA","agent":"Builder","skill":"builder","playbook":"dev-execution","triggers":[{"type":"after_task","taskRef":"Backlog Refinement","label":"After Backlog Refinement approval"}],"gates":[{"type":"playbook_done","label":"All stories done + QA pass"}]},
      {"role":"marketing","stage":"pre-sales","title":"Lead Generation","desc":"Processes, tools and campaigns","agent":"Growth","skill":"growth","playbook":"lead-generation","triggers":[{"type":"manual","label":"Manual start"}],"gates":[{"type":"playbook_done","label":"Lead qualified"}]},
      {"role":"marketing","stage":"in-dev","title":"Marketing Assets","desc":"Feature newsletter, product content & communication","agent":"Growth","skill":"growth","playbook":"marketing-assets","triggers":[{"type":"after_task","taskRef":"Backlog Refinement","label":"After Backlog Refinement"}],"gates":[{"type":"checkpoint","label":"Human reviews content"}]},
      {"role":"marketing","stage":"deployment","title":"Communication Confirmation","desc":"Consent for commercial communication","agent":"Growth","skill":"growth","playbook":"comms-confirmation","triggers":[{"type":"after_task","taskRef":"Production Rollout","label":"After Production Rollout"}],"gates":[{"type":"checkpoint","label":"Customer consent confirmed"}]},
      {"role":"marketing","stage":"delivered","title":"Use Cases","desc":"Customer content, photos, market analysis","agent":"Growth","skill":"growth","playbook":"use-cases","triggers":[{"type":"after_task","taskRef":"Customer Relationship","label":"After Customer Relationship starts"}],"gates":[{"type":"playbook_done","label":"Content published"}]},
      {"role":"marketing","stage":"delivered","title":"Client Communication","desc":"Newsletter, client satisfaction follow-up","agent":"Growth","skill":"growth","playbook":"client-communication","triggers":[{"type":"after_task","taskRef":"Use Cases","label":"After Use Cases"}],"gates":[{"type":"playbook_done","label":"Communication sent"}]},
      {"role":"infra","stage":"planning","title":"Installation & Infra Planning","desc":"Setup and IT requirements, prerequisites","agent":"DevOps","skill":"devops","playbook":"infra-planning","triggers":[{"type":"after_task","taskRef":"Project Scope & Planning","label":"After Project Scope & Planning"}],"gates":[{"type":"playbook_done","label":"Infra plan approved"}]},
      {"role":"infra","stage":"in-dev","title":"Support Content","desc":"Support website, LMS courses preparation","agent":"DevOps","skill":"devops","playbook":"support-content","triggers":[{"type":"after_task","taskRef":"Installation & Infra Planning","label":"After Infra Planning"}],"gates":[{"type":"playbook_done","label":"Content published"}]},
      {"role":"infra","stage":"deployment","title":"Setup & License","desc":"Infrastructure provisioning, license activation","agent":"DevOps","skill":"devops","playbook":"infra-setup","triggers":[{"type":"after_task","taskRef":"Acceptation","label":"After Acceptation"}],"gates":[{"type":"checkpoint","label":"Human confirms infra live"}]},
      {"role":"infra","stage":"delivered","title":"Customer Support","desc":"Helpdesk, training, documentation","agent":"DevOps","skill":"devops","playbook":"customer-support","triggers":[{"type":"after_task","taskRef":"Customer Relationship","label":"After Customer Relationship"}],"gates":[{"type":"manual","label":"Ongoing — human managed"}]}
    ]'::jsonb
  ),
  -- Product Development
  (
    'product-dev',
    'Product Development',
    '#10b981',
    false,
    '[
      {"id":"ideation","label":"Ideation","sub":"Problem definition"},
      {"id":"design","label":"Design","sub":"Spec & prototype"},
      {"id":"build","label":"Build","sub":"Vertical slice"},
      {"id":"review","label":"Review","sub":"Quality gate"},
      {"id":"ship","label":"Ship","sub":"Deployed"},
      {"id":"measure","label":"Measure","sub":"Feedback loop"}
    ]'::jsonb,
    '[
      {"id":"product","label":"Product","owner":"Andres"},
      {"id":"design","label":"Design","owner":"Designer Agent"},
      {"id":"engineering","label":"Engineering","owner":"Dev Team"},
      {"id":"qa","label":"Quality","owner":"QA Agent"}
    ]'::jsonb,
    '[
      {"role":"product","stage":"ideation","title":"Problem Statement","desc":"User, goal, constraints, metrics","agent":"PM","skill":"pm","playbook":"problem-framing","triggers":[{"type":"manual","label":"New feature request"}],"gates":[{"type":"playbook_done","label":"Schema-valid spec"}]},
      {"role":"design","stage":"ideation","title":"Discovery Research","desc":"Interviews, competitive analysis","agent":"Researcher","skill":"researcher","playbook":"discovery-research","triggers":[{"type":"after_task","taskRef":"Problem Statement","label":"Problem scoped"}],"gates":[{"type":"playbook_done","label":"Research report"}]},
      {"role":"product","stage":"design","title":"Slice Spec","desc":"Event catalog, data model","agent":"PM","skill":"pm","playbook":"slice-spec","triggers":[{"type":"after_task","taskRef":"Discovery Research","label":"Research complete"}],"gates":[{"type":"playbook_done","label":"Validate passes"}]},
      {"role":"design","stage":"design","title":"UI Prototype","desc":"Hi-fi, 3 variations","agent":"Designer","skill":"designer","playbook":"ui-design","checkpoint":true,"triggers":[{"type":"after_task","taskRef":"Slice Spec","label":"Spec validated"}],"gates":[{"type":"checkpoint","label":"Design review approval"}]},
      {"role":"engineering","stage":"build","title":"Vertical Slice","desc":"UI + API + persistence + telemetry","agent":"Builder","skill":"builder","playbook":"dev-execution","triggers":[{"type":"after_task","taskRef":"UI Prototype","label":"Design approved"}],"gates":[{"type":"playbook_done","label":"Deployed to staging"}]},
      {"role":"qa","stage":"review","title":"Quality Gate","desc":"Unit, E2E, accessibility, evals","agent":"QA Engineer","skill":"qa","playbook":"quality-gate","triggers":[{"type":"after_task","taskRef":"Vertical Slice","label":"Slice built"}],"gates":[{"type":"checkpoint","label":"All suites passing"}]}
    ]'::jsonb
  ),
  -- Go-to-Market
  (
    'gtm',
    'Go-to-Market',
    '#f59e0b',
    false,
    '[
      {"id":"positioning","label":"Positioning","sub":"ICP & narrative"},
      {"id":"assets","label":"Assets","sub":"Content & pages"},
      {"id":"launch","label":"Launch","sub":"Go live"},
      {"id":"growth","label":"Growth","sub":"Demand gen"},
      {"id":"retention","label":"Retention","sub":"Ongoing"}
    ]'::jsonb,
    '[
      {"id":"product","label":"Product","owner":"Andres"},
      {"id":"growth","label":"Growth","owner":"Growth Agent"},
      {"id":"content","label":"Content","owner":"Content Agent"}
    ]'::jsonb,
    '[
      {"role":"product","stage":"positioning","title":"ICP Definition","desc":"Ideal customer profile, JTBD","agent":"Strategist","skill":"strategist","playbook":"icp-definition","triggers":[{"type":"manual","label":"New launch"}],"gates":[{"type":"checkpoint","label":"Human approves ICP"}]},
      {"role":"content","stage":"assets","title":"Landing Page","desc":"Copy, design, analytics wiring","agent":"Growth","skill":"growth","playbook":"landing-page","triggers":[{"type":"after_task","taskRef":"ICP Definition","label":"ICP confirmed"}],"gates":[{"type":"checkpoint","label":"Human reviews page"}]},
      {"role":"growth","stage":"growth","title":"Outbound Sequence","desc":"Cold email + LinkedIn","agent":"Sales Ops","skill":"sales-ops","playbook":"outbound-sequence","triggers":[{"type":"after_task","taskRef":"Landing Page","label":"Page live"}],"gates":[{"type":"playbook_done","label":"Sequence launched"}]}
    ]'::jsonb
  ),
  -- Operations
  (
    'operations',
    'Operations',
    '#06b6d4',
    true,
    '[
      {"id":"monitor","label":"Monitor","sub":"Observability"},
      {"id":"triage","label":"Triage","sub":"Issues"},
      {"id":"resolve","label":"Resolve","sub":"Fix & deploy"},
      {"id":"learn","label":"Learn","sub":"Retro & improve"}
    ]'::jsonb,
    '[
      {"id":"infra","label":"Infra","owner":"Robert"},
      {"id":"support","label":"Support","owner":"Support Agent"},
      {"id":"finance","label":"Finance","owner":"Joanna"}
    ]'::jsonb,
    '[
      {"role":"infra","stage":"monitor","title":"Observability Sweep","desc":"Check dashboards, alerts, error budgets","agent":"DevOps","skill":"devops","playbook":"observability-sweep","triggers":[{"type":"manual","label":"Daily / on-call"}],"gates":[{"type":"playbook_done","label":"Sweep complete"}]},
      {"role":"support","stage":"triage","title":"Issue Triage","desc":"Scope, urgency, affected users","agent":"Support","skill":"support","playbook":"issue-triage","triggers":[{"type":"after_task","taskRef":"Observability Sweep","label":"Issues detected"}],"gates":[{"type":"checkpoint","label":"Triage P0/P1"}]},
      {"role":"infra","stage":"resolve","title":"Fix & Deploy","desc":"Investigate, patch, deploy","agent":"Builder","skill":"builder","playbook":"incident-resolution","triggers":[{"type":"after_task","taskRef":"Issue Triage","label":"Triage done"}],"gates":[{"type":"playbook_done","label":"Fix deployed"}]},
      {"role":"infra","stage":"learn","title":"Retro & Improve","desc":"Postmortem, action items","agent":"PM","skill":"pm","playbook":"postmortem","triggers":[{"type":"after_task","taskRef":"Fix & Deploy","label":"Incident closed"}],"gates":[{"type":"playbook_done","label":"Action items filed"}]}
    ]'::jsonb
  )
on conflict (id) do update set
  label          = excluded.label,
  color          = excluded.color,
  multi_instance = excluded.multi_instance,
  stages         = excluded.stages,
  roles          = excluded.roles,
  task_templates = excluded.task_templates,
  updated_at     = now();

-- ---------------------------------------------------------------------------
-- Framework items (Skills + Playbooks library)
-- Source: pc-components.jsx FRAMEWORK_ITEMS_DEFAULT.
-- ---------------------------------------------------------------------------
insert into public.framework_items (id, type, name, description, icon, content)
values
  ('sk-pm','skill','PM','Product management, spec authoring, prioritization','📋',
    E'# PM Skill\n\n## When to use\nShaping a requested change into scope, rationale, acceptance criteria, and implementation guidance.\n\n## Inputs\n- Goal, constraints, selected concept, affected surfaces\n\n## Outputs\n- Concise change brief, scope, non-goals, acceptance criteria\n\n## Steps\n1. Read relevant spec and decision log\n2. Clarify goal and constraints\n3. Define scope and non-goals\n4. Write testable acceptance criteria\n5. Flag risks and dependencies'),
  ('sk-designer','skill','Designer','UI/UX design, visual explorations, hi-fi prototypes','🎨',
    E'# Designer Skill\n\n## When to use\nCreating or refining visual assets, brand elements, and design directions.\n\n## Inputs\n- Goal, brand intent, target surface, references\n\n## Outputs\n- Concrete design directions, implementation-ready handoff\n\n## Steps\n1. Read design system tokens\n2. Explore 3+ directions\n3. Produce hi-fi variations\n4. Request human review\n5. Deliver specs'),
  ('sk-builder','skill','Builder','Implementation, vertical slices, tests','⚡',
    E'# Builder Skill\n\n## When to use\nImplementing changes and carrying them through validation, PR review, and merge.\n\n## Inputs\n- Approved scope, affected files, constraints\n\n## Outputs\n- Implementation, verification evidence, published PR\n\n## Steps\n1. Read spec and acceptance criteria\n2. Implement vertical slice\n3. Write tests\n4. Run validation gates\n5. Submit PR'),
  ('sk-devops','skill','DevOps','Infrastructure, deployment, environments','🔧',
    E'# DevOps Skill\n\n## When to use\nConfiguring infrastructure, deployment pipelines, environment separation.\n\n## Steps\n1. Survey current infrastructure\n2. Define requirements per service\n3. Configure environments\n4. Wire observability tools\n5. Document and verify'),
  ('sk-researcher','skill','Researcher','Market research, ICP analysis, discovery','🔍',
    E'# Researcher Skill\n\n## When to use\nMapped to discovery workflows, user interview synthesis, or competitive analysis.\n\n## Steps\n1. Define research questions\n2. Gather data\n3. Synthesize findings\n4. Produce structured report\n5. Flag assumptions'),
  ('sk-strategist','skill','Strategist','Strategic positioning, ICP, go-to-market','🧭',
    E'# Strategist Skill\n\n## When to use\nShaping positioning, ICP definition, and market strategy.\n\n## Steps\n1. Analyze market segments\n2. Define ICP and JTBD\n3. Map competitive landscape\n4. Produce positioning recommendations\n5. Validate with founder'),
  ('sk-qa','skill','QA Engineer','Testing, quality gates, regression coverage','✅',
    E'# QA Engineer Skill\n\n## When to use\nWriting tests, triaging CI failures, quality gates.\n\n## Steps\n1. Read spec and acceptance criteria\n2. Identify test layers\n3. Write unit, integration, E2E tests\n4. Run full suite\n5. Produce evidence bundle'),
  ('sk-project','skill','Project','Project management, planning, coordination','🗂️',
    E'# Project Skill\n\n## When to use\nManaging project timelines, coordination, and stakeholder alignment.\n\n## Steps\n1. Read project brief\n2. Define phases and timeline\n3. Identify dependencies\n4. Align stakeholders\n5. Track progress'),
  ('pb-presales','playbook','presales-qualification','Qualify new client opportunities','📄',
    E'# Presales Qualification\n\n## Objective\nAssess whether a new opportunity should proceed to PDR review.\n\n## Steps\n1. Gather project description\n2. Assess fit against ICP\n3. Estimate scope\n4. Produce qualification document\n5. Deliver to Product for review\n\n## Human checkpoints\n- None for standard qualification\n- Escalate for unusually large scope'),
  ('pb-backlog','playbook','backlog-refinement','Groom and estimate sprint backlog','📄',
    E'# Backlog Refinement\n\n## Objective\nPrepare a prioritized, estimated backlog for sprint kick-off.\n\n## Steps\n1. Read product spec\n2. Map requirements to epics\n3. Generate stories with acceptance criteria\n4. Estimate effort (SP)\n5. Flag overflow\n6. Request human approval\n\n## Human checkpoints\n- Approval required before sprint starts'),
  ('pb-devexec','playbook','dev-execution','Implement a vertical slice end to end','📄',
    E'# Dev Execution\n\n## Objective\nDeliver a complete vertical slice: UI + API + persistence + telemetry.\n\n## Steps\n1. Set up branch\n2. Implement UI\n3. Implement API\n4. Wire persistence\n5. Add telemetry\n6. Write tests\n7. Run gates\n8. Submit PR\n\n## Human checkpoints\n- PR review before merge'),
  ('pb-quality','playbook','quality-gate','Run all quality gates before shipping','📄',
    E'# Quality Gate\n\n## Objective\nEnsure production-readiness before merge.\n\n## Steps\n1. Run unit tests\n2. Run integration tests\n3. Run E2E (Playwright)\n4. Check accessibility\n5. Run evals\n6. Produce evidence bundle\n\n## Human checkpoints\n- Spot-check for high-risk changes')
on conflict (id) do update set
  type        = excluded.type,
  name        = excluded.name,
  description = excluded.description,
  icon        = excluded.icon,
  content     = excluded.content,
  updated_at  = now();
