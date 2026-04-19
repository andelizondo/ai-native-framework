-- Workflow persistence tables for the AI-Native Platform Dashboard (PR 4 / AEL-47).
--
-- Source of truth for entity shapes: `spec/examples/platform-product.yaml`
-- (data_model.entities). Field comments below name the spec entity each column
-- maps to. Repository contracts live in `interfaces/interfaces.yaml` under the
-- `workflow_repository` adapter; business logic targets those interfaces, not
-- this schema directly, so the storage backend stays swappable.
--
-- V1 scope (DEC-002): one company, one founder, no multi-tenancy. RLS is still
-- non-negotiable — every table is locked down to authenticated users so the
-- dashboard can never accidentally serve rows over an unauthenticated session.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- workflow_templates: reusable definition of a workflow (WorkflowTemplate).
-- ---------------------------------------------------------------------------
create table if not exists public.workflow_templates (
  id              text primary key,
  label           text not null,
  color           text not null,
  multi_instance  boolean not null default false,
  stages          jsonb not null default '[]'::jsonb,
  roles           jsonb not null default '[]'::jsonb,
  task_templates  jsonb not null default '[]'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table public.workflow_templates is
  'Reusable workflow definitions (WorkflowTemplate per spec/examples/platform-product.yaml).';

-- ---------------------------------------------------------------------------
-- workflow_instances: a running instance of a template (WorkflowInstance).
-- ---------------------------------------------------------------------------
create table if not exists public.workflow_instances (
  id          uuid primary key default gen_random_uuid(),
  template_id text not null references public.workflow_templates(id) on delete restrict,
  label       text not null,
  status      text not null default 'active'
    check (status in ('not_started', 'active', 'blocked', 'complete')),
  roles       jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists workflow_instances_template_id_idx
  on public.workflow_instances (template_id);

comment on table public.workflow_instances is
  'Running instances of workflow templates (WorkflowInstance).';

-- ---------------------------------------------------------------------------
-- workflow_tasks: atomic unit of work inside an instance (WorkflowTask).
-- Stage and role identifiers reference the JSONB stages/roles arrays on the
-- parent template/instance; we store the string id rather than a hard FK so
-- template edits cannot orphan rows.
-- ---------------------------------------------------------------------------
create table if not exists public.workflow_tasks (
  id          uuid primary key default gen_random_uuid(),
  instance_id uuid not null references public.workflow_instances(id) on delete cascade,
  role_id     text not null,
  stage_id    text not null,
  title       text not null,
  description text not null default '',
  status      text not null default 'not_started'
    check (status in ('not_started', 'active', 'pending_approval', 'blocked', 'complete')),
  substatus   text not null default '',
  checkpoint  boolean not null default false,
  triggers    jsonb not null default '[]'::jsonb,
  gates       jsonb not null default '[]'::jsonb,
  agent       text,
  skill       text,
  playbook    text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists workflow_tasks_instance_id_idx
  on public.workflow_tasks (instance_id);
create index if not exists workflow_tasks_status_idx
  on public.workflow_tasks (status);

comment on table public.workflow_tasks is
  'Per-instance task rows materialized from a template''s task_templates (WorkflowTask).';
comment on column public.workflow_tasks.description is
  'Renamed from spec field `desc` to avoid the SQL reserved word.';

-- ---------------------------------------------------------------------------
-- workflow_events: structured domain events (WorkflowEvent).
-- ---------------------------------------------------------------------------
create table if not exists public.workflow_events (
  id          uuid primary key default gen_random_uuid(),
  instance_id uuid not null references public.workflow_instances(id) on delete cascade,
  task_id     uuid references public.workflow_tasks(id) on delete cascade,
  name        text not null,
  description text not null default '',
  payload     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists workflow_events_instance_id_idx
  on public.workflow_events (instance_id, created_at desc);
create index if not exists workflow_events_task_id_idx
  on public.workflow_events (task_id, created_at desc);

comment on table public.workflow_events is
  'Domain events emitted against an instance/task (WorkflowEvent). Feeds the Event Feed.';

-- ---------------------------------------------------------------------------
-- framework_items: editable Skills + Playbooks library (FrameworkItem).
-- ---------------------------------------------------------------------------
create table if not exists public.framework_items (
  id          text primary key,
  type        text not null check (type in ('skill', 'playbook')),
  name        text not null,
  description text not null default '',
  icon        text,
  content     text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists framework_items_type_idx
  on public.framework_items (type);

comment on table public.framework_items is
  'Founder-authored Skills and Playbooks rendered by the Framework screens (FrameworkItem).';

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists workflow_templates_set_updated_at on public.workflow_templates;
create trigger workflow_templates_set_updated_at
  before update on public.workflow_templates
  for each row execute function public.set_updated_at();

drop trigger if exists workflow_instances_set_updated_at on public.workflow_instances;
create trigger workflow_instances_set_updated_at
  before update on public.workflow_instances
  for each row execute function public.set_updated_at();

drop trigger if exists workflow_tasks_set_updated_at on public.workflow_tasks;
create trigger workflow_tasks_set_updated_at
  before update on public.workflow_tasks
  for each row execute function public.set_updated_at();

drop trigger if exists framework_items_set_updated_at on public.framework_items;
create trigger framework_items_set_updated_at
  before update on public.framework_items
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security — single-user V1 per DEC-002.
-- Every table is restricted to authenticated users. Policies are intentionally
-- coarse (any signed-in session sees all rows) because V1 has exactly one
-- founder per installation; multi-tenant scoping arrives with a later PR when
-- a `company_id` is introduced.
-- ---------------------------------------------------------------------------
alter table public.workflow_templates enable row level security;
alter table public.workflow_instances enable row level security;
alter table public.workflow_tasks     enable row level security;
alter table public.workflow_events    enable row level security;
alter table public.framework_items    enable row level security;

drop policy if exists "workflow_templates: authenticated read"   on public.workflow_templates;
drop policy if exists "workflow_templates: authenticated write"  on public.workflow_templates;
create policy "workflow_templates: authenticated read"
  on public.workflow_templates for select to authenticated using (true);
create policy "workflow_templates: authenticated write"
  on public.workflow_templates for all     to authenticated using (true) with check (true);

drop policy if exists "workflow_instances: authenticated read"   on public.workflow_instances;
drop policy if exists "workflow_instances: authenticated write"  on public.workflow_instances;
create policy "workflow_instances: authenticated read"
  on public.workflow_instances for select to authenticated using (true);
create policy "workflow_instances: authenticated write"
  on public.workflow_instances for all     to authenticated using (true) with check (true);

drop policy if exists "workflow_tasks: authenticated read"   on public.workflow_tasks;
drop policy if exists "workflow_tasks: authenticated write"  on public.workflow_tasks;
create policy "workflow_tasks: authenticated read"
  on public.workflow_tasks for select to authenticated using (true);
create policy "workflow_tasks: authenticated write"
  on public.workflow_tasks for all     to authenticated using (true) with check (true);

drop policy if exists "workflow_events: authenticated read"   on public.workflow_events;
drop policy if exists "workflow_events: authenticated write"  on public.workflow_events;
create policy "workflow_events: authenticated read"
  on public.workflow_events for select to authenticated using (true);
create policy "workflow_events: authenticated write"
  on public.workflow_events for all     to authenticated using (true) with check (true);

drop policy if exists "framework_items: authenticated read"   on public.framework_items;
drop policy if exists "framework_items: authenticated write"  on public.framework_items;
create policy "framework_items: authenticated read"
  on public.framework_items for select to authenticated using (true);
create policy "framework_items: authenticated write"
  on public.framework_items for all     to authenticated using (true) with check (true);
