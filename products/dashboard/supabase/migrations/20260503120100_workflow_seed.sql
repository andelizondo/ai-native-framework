-- Seed migration for canonical workflow templates and the founder Skills /
-- Playbooks library used by the dashboard mock data.
--
-- Schema notes:
--   * Matrix rows are now Skills. Each row id matches a framework_items row of
--     type 'skill'. Skill ids use slug-style names (e.g. 'pm', 'builder').
--   * Tasks are simplified to (skillId, stageId, playbookId, notes, …).
--     Title/description/agent come from the linked framework_items playbook.
--   * framework_item_allowed_skills gates which playbooks appear in the
--     playbook picker for a given skill row.
--
-- Idempotent: rerunning against an existing dev DB refreshes the seed in place.

-- ---------------------------------------------------------------------------
-- Framework items: Skills (id == slug name) + Playbooks (id == slug name)
-- ---------------------------------------------------------------------------
insert into public.framework_items (id, type, name, description, icon, content)
values
  -- Skills
  ('pm','skill','PM','Product management, spec authoring, prioritization','📋',
    E'# PM Skill\n\n## When to use\nShape requested changes into scope, rationale, acceptance criteria.\n\n## Steps\n1. Read relevant spec and decisions\n2. Clarify goal and constraints\n3. Define scope and non-goals\n4. Write testable acceptance criteria\n5. Flag risks and dependencies'),
  ('designer','skill','Designer','UI/UX design, visual explorations, hi-fi prototypes','🎨',
    E'# Designer Skill\n\n## Steps\n1. Read design system tokens\n2. Explore 3+ directions\n3. Produce hi-fi variations\n4. Request human review\n5. Deliver specs'),
  ('builder','skill','Builder','Implementation, vertical slices, tests','⚡',
    E'# Builder Skill\n\n## Steps\n1. Read spec and acceptance criteria\n2. Implement vertical slice\n3. Write tests\n4. Run validation gates\n5. Submit PR'),
  ('devops','skill','DevOps','Infrastructure, deployment, environments','🔧',
    E'# DevOps Skill\n\n## Steps\n1. Survey current infrastructure\n2. Define requirements\n3. Configure environments\n4. Wire observability\n5. Document and verify'),
  ('researcher','skill','Researcher','Market research, ICP analysis, discovery','🔍',
    E'# Researcher Skill\n\n## Steps\n1. Define research questions\n2. Gather data\n3. Synthesize findings\n4. Produce report\n5. Flag assumptions'),
  ('strategist','skill','Strategist','Strategic positioning, ICP, go-to-market','🧭',
    E'# Strategist Skill\n\n## Steps\n1. Analyze market segments\n2. Define ICP and JTBD\n3. Map competitive landscape\n4. Produce positioning\n5. Validate with founder'),
  ('qa','skill','QA','Testing, quality gates, regression coverage','✅',
    E'# QA Skill\n\n## Steps\n1. Read spec\n2. Identify test layers\n3. Write tests\n4. Run full suite\n5. Produce evidence'),
  ('project','skill','Project','Project management, planning, coordination','🗂️',
    E'# Project Skill\n\n## Steps\n1. Read project brief\n2. Define phases\n3. Identify dependencies\n4. Align stakeholders\n5. Track progress'),
  ('sales-ops','skill','Sales Ops','Pre-sales, account management, sales playbooks','🤝',
    E'# Sales Ops Skill\n\n## Steps\n1. Qualify opportunity\n2. Confirm scope\n3. Run handoffs\n4. Track account health'),
  ('finance-ops','skill','Finance Ops','Invoicing, registration, financial closure','💰',
    E'# Finance Ops Skill\n\n## Steps\n1. Issue invoices\n2. Confirm POs\n3. Register quotes\n4. Close financially'),
  ('growth','skill','Growth','Demand gen, content, marketing assets','📈',
    E'# Growth Skill\n\n## Steps\n1. Lead generation\n2. Marketing assets\n3. Communication\n4. Use cases'),
  ('support','skill','Support','Customer support, triage, helpdesk','🎧',
    E'# Support Skill\n\n## Steps\n1. Triage issue\n2. Reproduce\n3. Resolve or escalate\n4. Communicate to customer'),

  -- Playbooks (Product Development)
  ('problem-framing','playbook','Problem Statement','User, goal, constraints, metrics','📝',
    E'# Problem Framing\n\n## Objective\nProduce a clear problem statement.\n\n## Steps\n1. Identify user persona\n2. State the problem\n3. List constraints\n4. Define success metrics'),
  ('discovery-research','playbook','Discovery Research','Interviews, competitive analysis','🔬',
    E'# Discovery Research\n\n## Steps\n1. Define research questions\n2. Run interviews\n3. Competitive scan\n4. Synthesize findings'),
  ('slice-spec','playbook','Slice Spec','Event catalog, data model','📐',
    E'# Slice Spec\n\n## Steps\n1. Define events\n2. Sketch data model\n3. Validate against schema\n4. Hand off to design'),
  ('ui-design','playbook','UI Prototype','Hi-fi prototype with variations','🎨',
    E'# UI Design\n\n## Steps\n1. Wireframes\n2. Hi-fi variations (3+)\n3. Design review\n4. Handoff specs'),
  ('dev-execution','playbook','Vertical Slice','UI + API + persistence + telemetry','⚙️',
    E'# Dev Execution\n\n## Steps\n1. Branch\n2. Implement UI/API/persistence\n3. Telemetry\n4. Tests\n5. PR'),
  ('quality-gate','playbook','Quality Gate','Unit, E2E, accessibility, evals','🧪',
    E'# Quality Gate\n\n## Steps\n1. Unit tests\n2. E2E\n3. Accessibility\n4. Evals\n5. Evidence bundle'),

  -- Playbooks (Go-to-Market)
  ('icp-definition','playbook','ICP Definition','Ideal customer profile, JTBD','🎯',
    E'# ICP Definition\n\n## Steps\n1. Segment market\n2. Define ICP\n3. JTBD framing\n4. Validate'),
  ('landing-page','playbook','Landing Page','Copy, design, analytics wiring','🌐',
    E'# Landing Page\n\n## Steps\n1. Copy\n2. Design\n3. Build\n4. Analytics\n5. Review'),
  ('outbound-sequence','playbook','Outbound Sequence','Cold email + LinkedIn','📧',
    E'# Outbound Sequence\n\n## Steps\n1. List building\n2. Sequence drafting\n3. Send\n4. Iterate'),

  -- Playbooks (Operations)
  ('observability-sweep','playbook','Observability Sweep','Dashboards, alerts, error budgets','📊',
    E'# Observability Sweep\n\n## Steps\n1. Review dashboards\n2. Check alerts\n3. Error budget posture\n4. File issues'),
  ('issue-triage','playbook','Issue Triage','Scope, urgency, affected users','🚨',
    E'# Issue Triage\n\n## Steps\n1. Reproduce\n2. Classify severity\n3. Assign\n4. Communicate'),
  ('incident-resolution','playbook','Incident Resolution','Investigate, patch, deploy','🔥',
    E'# Incident Resolution\n\n## Steps\n1. Diagnose\n2. Patch\n3. Test\n4. Deploy\n5. Verify'),
  ('postmortem','playbook','Postmortem','Retro, action items','📓',
    E'# Postmortem\n\n## Steps\n1. Timeline\n2. Root cause\n3. Action items\n4. File and follow up'),

  -- Playbooks (Client Project Delivery)
  ('presales-qualification','playbook','Presales Qualification','Qualify new client opportunities','📄',
    E'# Presales Qualification\n\n## Steps\n1. Gather project description\n2. Assess fit\n3. Estimate scope\n4. Document\n5. Hand off to Product'),
  ('pdr-review','playbook','PDR Review','Evaluate, accept or reject, offer to customer','🧐',
    E'# PDR Review\n\n## Steps\n1. Read PDR\n2. Evaluate\n3. Decision\n4. Offer to customer'),
  ('project-planning','playbook','Project Planning','Timeline, phases, dependencies','🗓️',
    E'# Project Planning\n\n## Steps\n1. Phases\n2. Timeline\n3. Dependencies\n4. Customer alignment'),
  ('initial-invoicing','playbook','Initial Invoicing','Send initial invoice (usually 50%)','💸',
    E'# Initial Invoicing\n\n## Steps\n1. Confirm scope\n2. Generate invoice\n3. Send'),
  ('infra-setup','playbook','Infra Setup','Provisioning, license activation','🔌',
    E'# Infra Setup\n\n## Steps\n1. Plan\n2. Provision\n3. License\n4. Verify')
on conflict (id) do update set
  type        = excluded.type,
  name        = excluded.name,
  description = excluded.description,
  icon        = excluded.icon,
  content     = excluded.content,
  updated_at  = now();

-- ---------------------------------------------------------------------------
-- Allowed-skills mappings: which Playbooks each Skill row can pick from.
-- ---------------------------------------------------------------------------
insert into public.framework_item_allowed_skills (playbook_id, skill_id)
values
  -- Product Development
  ('problem-framing','pm'),
  ('discovery-research','researcher'),
  ('slice-spec','pm'),
  ('ui-design','designer'),
  ('dev-execution','builder'),
  ('quality-gate','qa'),
  -- Go-to-Market
  ('icp-definition','strategist'),
  ('icp-definition','pm'),
  ('landing-page','growth'),
  ('outbound-sequence','sales-ops'),
  ('outbound-sequence','growth'),
  -- Operations
  ('observability-sweep','devops'),
  ('issue-triage','support'),
  ('incident-resolution','builder'),
  ('incident-resolution','devops'),
  ('postmortem','pm'),
  -- Client Project Delivery
  ('presales-qualification','sales-ops'),
  ('pdr-review','pm'),
  ('project-planning','project'),
  ('initial-invoicing','finance-ops'),
  ('infra-setup','devops')
on conflict (playbook_id, skill_id) do nothing;

-- ---------------------------------------------------------------------------
-- Workflow templates
-- ---------------------------------------------------------------------------
insert into public.workflow_templates (id, label, color, multi_instance, stages, skills, task_templates)
values
  -- Client Project Delivery
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
      {"id":"sales-ops","label":"Sales Ops","owner":"Hans / Dave"},
      {"id":"pm","label":"PM","owner":"Andres / Dechaun"},
      {"id":"finance-ops","label":"Finance Ops","owner":"Joanna"},
      {"id":"project","label":"Project","owner":"Patrick"},
      {"id":"builder","label":"Builder","owner":"Noah / Dev Team"},
      {"id":"growth","label":"Growth","owner":"Cristina"},
      {"id":"devops","label":"DevOps","owner":"Robert"}
    ]'::jsonb,
    '[
      {"skillId":"sales-ops","stageId":"pre-sales","playbookId":"presales-qualification","notes":"","triggers":[{"type":"manual","label":"Manual start"}],"gates":[{"type":"playbook_done","label":"Agent completes playbook"}]},
      {"skillId":"pm","stageId":"validation","playbookId":"pdr-review","notes":"","triggers":[{"type":"after_task","taskRef":"Presales Qualification","label":"After Presales Qualification"}],"gates":[{"type":"checkpoint","label":"Human approval"}]},
      {"skillId":"finance-ops","stageId":"ready","playbookId":"initial-invoicing","notes":"","triggers":[{"type":"after_task","taskRef":"PDR Review","label":"After PDR Review"}],"gates":[{"type":"playbook_done","label":"Invoice sent"}]},
      {"skillId":"project","stageId":"planning","playbookId":"project-planning","notes":"","triggers":[],"gates":[{"type":"checkpoint","label":"Plan reviewed"}]},
      {"skillId":"builder","stageId":"in-dev","playbookId":"dev-execution","notes":"","triggers":[{"type":"after_task","taskRef":"Project Planning","label":"After Project Planning"}],"gates":[{"type":"playbook_done","label":"Slice deployed"}]},
      {"skillId":"devops","stageId":"deployment","playbookId":"infra-setup","notes":"","triggers":[],"gates":[{"type":"checkpoint","label":"Infra live"}]}
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
      {"id":"pm","label":"PM","owner":"Andres"},
      {"id":"designer","label":"Designer","owner":"Designer Agent"},
      {"id":"builder","label":"Builder","owner":"Dev Team"},
      {"id":"qa","label":"QA","owner":"QA Agent"},
      {"id":"researcher","label":"Researcher","owner":"Researcher Agent"}
    ]'::jsonb,
    '[
      {"skillId":"pm","stageId":"ideation","playbookId":"problem-framing","notes":"","triggers":[{"type":"manual","label":"New feature request"}],"gates":[{"type":"playbook_done","label":"Schema-valid spec"}]},
      {"skillId":"researcher","stageId":"ideation","playbookId":"discovery-research","notes":"","triggers":[{"type":"after_task","taskRef":"Problem Statement","label":"Problem scoped"}],"gates":[{"type":"playbook_done","label":"Research report"}]},
      {"skillId":"pm","stageId":"design","playbookId":"slice-spec","notes":"","triggers":[{"type":"after_task","taskRef":"Discovery Research","label":"Research complete"}],"gates":[{"type":"playbook_done","label":"Validate passes"}]},
      {"skillId":"designer","stageId":"design","playbookId":"ui-design","notes":"","checkpoint":true,"triggers":[{"type":"after_task","taskRef":"Slice Spec","label":"Spec validated"}],"gates":[{"type":"checkpoint","label":"Design review approval"}]},
      {"skillId":"builder","stageId":"build","playbookId":"dev-execution","notes":"","triggers":[{"type":"after_task","taskRef":"UI Prototype","label":"Design approved"}],"gates":[{"type":"playbook_done","label":"Deployed to staging"}]},
      {"skillId":"qa","stageId":"review","playbookId":"quality-gate","notes":"","triggers":[{"type":"after_task","taskRef":"Vertical Slice","label":"Slice built"}],"gates":[{"type":"checkpoint","label":"All suites passing"}]}
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
      {"id":"pm","label":"PM","owner":"Andres"},
      {"id":"strategist","label":"Strategist","owner":"Strategy Agent"},
      {"id":"growth","label":"Growth","owner":"Growth Agent"},
      {"id":"sales-ops","label":"Sales Ops","owner":"Sales Agent"}
    ]'::jsonb,
    '[
      {"skillId":"strategist","stageId":"positioning","playbookId":"icp-definition","notes":"","triggers":[{"type":"manual","label":"New launch"}],"gates":[{"type":"checkpoint","label":"ICP approved"}]},
      {"skillId":"growth","stageId":"assets","playbookId":"landing-page","notes":"","triggers":[{"type":"after_task","taskRef":"ICP Definition","label":"ICP confirmed"}],"gates":[{"type":"checkpoint","label":"Page reviewed"}]},
      {"skillId":"sales-ops","stageId":"growth","playbookId":"outbound-sequence","notes":"","triggers":[{"type":"after_task","taskRef":"Landing Page","label":"Page live"}],"gates":[{"type":"playbook_done","label":"Sequence launched"}]}
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
      {"id":"devops","label":"DevOps","owner":"Robert"},
      {"id":"support","label":"Support","owner":"Support Agent"},
      {"id":"builder","label":"Builder","owner":"Dev Team"},
      {"id":"pm","label":"PM","owner":"Andres"}
    ]'::jsonb,
    '[
      {"skillId":"devops","stageId":"monitor","playbookId":"observability-sweep","notes":"","triggers":[{"type":"manual","label":"Daily / on-call"}],"gates":[{"type":"playbook_done","label":"Sweep complete"}]},
      {"skillId":"support","stageId":"triage","playbookId":"issue-triage","notes":"","triggers":[{"type":"after_task","taskRef":"Observability Sweep","label":"Issues detected"}],"gates":[{"type":"checkpoint","label":"Triage P0/P1"}]},
      {"skillId":"builder","stageId":"resolve","playbookId":"incident-resolution","notes":"","triggers":[{"type":"after_task","taskRef":"Issue Triage","label":"Triage done"}],"gates":[{"type":"playbook_done","label":"Fix deployed"}]},
      {"skillId":"pm","stageId":"learn","playbookId":"postmortem","notes":"","triggers":[{"type":"after_task","taskRef":"Incident Resolution","label":"Incident closed"}],"gates":[{"type":"playbook_done","label":"Action items filed"}]}
    ]'::jsonb
  )
on conflict (id) do update set
  label          = excluded.label,
  color          = excluded.color,
  multi_instance = excluded.multi_instance,
  stages         = excluded.stages,
  skills         = excluded.skills,
  task_templates = excluded.task_templates,
  updated_at     = now();
