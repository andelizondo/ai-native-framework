-- PR 2 / AEL-60 — Playbook Drawer redesign schema spine.
--
-- Builds on PR 1 (AEL-59) which renamed triggers/gates → inputs in the
-- TypeScript layer. This migration finishes the rename on the database side
-- and lays the new IO-state spine the redesigned drawer (PR 3) will consume:
--
--   * Rename workflow_tasks.triggers → inputs (gate column dropped).
--   * Extend workflow_tasks.status from the legacy 5-value enum to the
--     7-value design enum (not_started | waiting | paused | in_progress |
--     running | complete | failed) and migrate existing rows.
--   * Add paused_reason / paused_by / paused_at to workflow_tasks.
--   * Create playbook_outputs (definition-level), task_outputs and
--     task_inputs (per-instance state).
--   * Install on_task_output_produced trigger that auto-flips downstream
--     task_inputs.received when an upstream output reaches 'produced'.
--   * Backfill task_inputs rows for already-existing tasks so live work
--     does not appear blocked after deploy.
--
-- RLS follows the existing single-tenant V1 pattern (DEC-002, see
-- 20260419120000_workflow_persistence.sql lines 9-11 and 164-168). The
-- Linear issue mentions org-scoped policies, but this codebase has no
-- org_id column yet — coarse "authenticated using (true)" stays consistent
-- and tightening lands with the future multi-tenant migration.

-- ---------------------------------------------------------------------------
-- 1. Rename triggers → inputs and drop gates.
-- ---------------------------------------------------------------------------
alter table public.workflow_tasks rename column triggers to inputs;
alter table public.workflow_tasks drop column if exists gates;

-- ---------------------------------------------------------------------------
-- 2. Pause-state columns. Added before the status row migration so the
--    UPDATE below can populate paused_reason in one pass.
-- ---------------------------------------------------------------------------
alter table public.workflow_tasks
  add column if not exists paused_reason text,
  add column if not exists paused_by     text,
  add column if not exists paused_at     timestamptz;

-- ---------------------------------------------------------------------------
-- 3. Status enum: drop the legacy CHECK constraint, migrate rows, then add
--    the new constraint covering all 7 design states.
-- ---------------------------------------------------------------------------
do $$
declare
  con text;
begin
  select conname into con
    from pg_constraint
   where conrelid = 'public.workflow_tasks'::regclass
     and contype = 'c'
     and pg_get_constraintdef(oid) ilike '%status%';
  if con is not null then
    execute format('alter table public.workflow_tasks drop constraint %I', con);
  end if;
end $$;

-- pending_approval → paused (with checkpoint reason); active → in_progress;
-- blocked → failed. paused_at is set to now() so the UI banner has a
-- timestamp; paused_by stays null since the original actor is unknown.
update public.workflow_tasks
   set status = case status
                  when 'active'           then 'in_progress'
                  when 'blocked'          then 'failed'
                  when 'pending_approval' then 'paused'
                  else status
                end,
       paused_reason = case
                         when status = 'pending_approval' then 'checkpoint'
                         else paused_reason
                       end,
       paused_at = case
                     when status = 'pending_approval' and paused_at is null then now()
                     else paused_at
                   end
 where status in ('active', 'blocked', 'pending_approval');

alter table public.workflow_tasks
  add constraint workflow_tasks_status_check
    check (status in (
      'not_started',
      'waiting',
      'paused',
      'in_progress',
      'running',
      'complete',
      'failed'
    ));

comment on column public.workflow_tasks.paused_reason is
  'Why this task is paused (e.g. ''checkpoint'', ''awaiting_input''). Drives the drawer pause banner. Null when status != ''paused''.';

-- ---------------------------------------------------------------------------
-- 4. playbook_outputs — definition-level outputs declared on a Playbook.
--    Outputs of one task become Inputs of others (wired via
--    workflow_tasks.inputs[].upstreamOutputId, populated by the editor in
--    a follow-up PR; until then outputs are admin-creatable via SQL).
-- ---------------------------------------------------------------------------
create table if not exists public.playbook_outputs (
  id           uuid primary key default gen_random_uuid(),
  playbook_id  text not null
                 references public.framework_items(id) on delete cascade,
  name         text not null,
  description  text,
  kind         text check (kind in ('file', 'media', 'link', 'manual', 'api')),
  api_check    jsonb,
  position     int not null default 0,
  created_at   timestamptz not null default now(),
  unique (playbook_id, name)
);

create index if not exists playbook_outputs_playbook_id_idx
  on public.playbook_outputs (playbook_id);

comment on table public.playbook_outputs is
  'Outputs declared on a Playbook definition. One playbook has 1-3 outputs typically; outputs become inputs of downstream tasks via WorkflowInput.upstreamOutputId.';

-- ---------------------------------------------------------------------------
-- 5. task_outputs — per-task-instance output state. One row per
--    (task, playbook_output) pair, materialized when the task starts
--    (or backfilled lazily) and flipped to 'produced' when the artifact
--    is delivered.
-- ---------------------------------------------------------------------------
create table if not exists public.task_outputs (
  id            uuid primary key default gen_random_uuid(),
  task_id       uuid not null
                  references public.workflow_tasks(id) on delete cascade,
  output_id     uuid not null
                  references public.playbook_outputs(id) on delete cascade,
  status        text not null default 'pending'
                  check (status in ('pending', 'produced', 'failed', 'skipped')),
  artifact_url  text,
  artifact_meta jsonb,
  produced_by   text,
  produced_at   timestamptz,
  created_at    timestamptz not null default now(),
  unique (task_id, output_id)
);

create index if not exists task_outputs_task_id_idx
  on public.task_outputs (task_id);

comment on table public.task_outputs is
  'Per-task instance state for each declared playbook output. Producing one (status=''produced'') triggers on_task_output_produced to satisfy downstream linked inputs.';

-- ---------------------------------------------------------------------------
-- 6. task_inputs — per-task-instance input state. One row per
--    WorkflowInput (matched by input_id, the JSONB id field). For linked
--    inputs the trigger below flips received=true automatically; manual
--    inputs are flipped by markInputReceivedAction; bypass inputs are
--    inserted with received=true at task creation.
-- ---------------------------------------------------------------------------
create table if not exists public.task_inputs (
  id             uuid primary key default gen_random_uuid(),
  task_id        uuid not null
                   references public.workflow_tasks(id) on delete cascade,
  input_id       text not null,
  received       boolean not null default false,
  received_at    timestamptz,
  received_from  uuid references public.task_outputs(id) on delete set null,
  unique (task_id, input_id)
);

create index if not exists task_inputs_task_id_idx
  on public.task_inputs (task_id);

comment on table public.task_inputs is
  'Per-task instance state for each WorkflowInput. received=true unblocks the task (deriveStatus moves it from waiting → not_started/in_progress).';

-- ---------------------------------------------------------------------------
-- 7. Auto-satisfy trigger. When a task_outputs row reaches status='produced',
--    walk every workflow_tasks row whose inputs[].upstreamOutputId points
--    at NEW.output_id and upsert task_inputs(received=true) for the
--    matching input slot. Runs in the same transaction as the producing
--    write so downstream readiness is visible immediately.
-- ---------------------------------------------------------------------------
create or replace function public.on_task_output_produced()
returns trigger
language plpgsql
as $$
begin
  if NEW.status = 'produced'
     and (TG_OP = 'INSERT' or OLD.status is distinct from 'produced') then
    with downstream as (
      select t.id as task_id,
             (input_def ->> 'id') as input_id
        from public.workflow_tasks t,
             jsonb_array_elements(coalesce(t.inputs, '[]'::jsonb)) as input_def
       where (input_def ->> 'upstreamOutputId') = NEW.output_id::text
         and (input_def ->> 'id') is not null
    )
    insert into public.task_inputs (task_id, input_id, received, received_at, received_from)
    select task_id, input_id, true, now(), NEW.id
      from downstream
        on conflict (task_id, input_id)
        do update set received      = true,
                      received_at   = excluded.received_at,
                      received_from = excluded.received_from;
  end if;
  return NEW;
end $$;

drop trigger if exists task_outputs_on_produced on public.task_outputs;
create trigger task_outputs_on_produced
  after insert or update of status on public.task_outputs
  for each row execute function public.on_task_output_produced();

-- ---------------------------------------------------------------------------
-- 8. Backfill task_inputs rows for tasks that already exist. Tasks past
--    not_started are treated as already-unblocked so live work does not
--    appear blocked after deploy; not_started tasks stay received=false
--    so the new waiting state actually engages.
-- ---------------------------------------------------------------------------
insert into public.task_inputs (task_id, input_id, received, received_at)
select t.id,
       (i ->> 'id'),
       (t.status <> 'not_started'),
       case when t.status <> 'not_started' then now() else null end
  from public.workflow_tasks t,
       jsonb_array_elements(coalesce(t.inputs, '[]'::jsonb)) as i
 where (i ->> 'id') is not null
on conflict (task_id, input_id) do nothing;

-- ---------------------------------------------------------------------------
-- 9. RLS — match the coarse "authenticated using (true)" pattern from
--    workflow_tasks etc. (DEC-002, single-tenant V1). Org-scoped policies
--    arrive with the future multi-tenant migration.
-- ---------------------------------------------------------------------------
alter table public.playbook_outputs enable row level security;
alter table public.task_outputs     enable row level security;
alter table public.task_inputs      enable row level security;

drop policy if exists "playbook_outputs: authenticated read"  on public.playbook_outputs;
drop policy if exists "playbook_outputs: authenticated write" on public.playbook_outputs;
create policy "playbook_outputs: authenticated read"
  on public.playbook_outputs for select to authenticated using (true);
create policy "playbook_outputs: authenticated write"
  on public.playbook_outputs for all to authenticated using (true) with check (true);

drop policy if exists "task_outputs: authenticated read"  on public.task_outputs;
drop policy if exists "task_outputs: authenticated write" on public.task_outputs;
create policy "task_outputs: authenticated read"
  on public.task_outputs for select to authenticated using (true);
create policy "task_outputs: authenticated write"
  on public.task_outputs for all to authenticated using (true) with check (true);

drop policy if exists "task_inputs: authenticated read"  on public.task_inputs;
drop policy if exists "task_inputs: authenticated write" on public.task_inputs;
create policy "task_inputs: authenticated read"
  on public.task_inputs for select to authenticated using (true);
create policy "task_inputs: authenticated write"
  on public.task_inputs for all to authenticated using (true) with check (true);
