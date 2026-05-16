-- Playbook-level input declarations. An input is always a reference to an
-- output of another playbook — there is no free-form text or manual mode
-- (those concerns belong in the playbook's instructions/content). The
-- `kind` (file/media/link/api/manual) lives on the upstream output and is
-- what drives later completion (upload, URL, API check, etc.).
--
-- This migration also drops the legacy `linkMode` discriminator on
-- `workflow_tasks.inputs` JSONB: every entry now carries an
-- `upstreamOutputId`, and rows that previously stored `manual`/`bypass`
-- variants are pruned (their semantics now live in playbook content +
-- per-task `bypassInputAction` runtime calls).

create table if not exists public.playbook_inputs (
  id                  uuid primary key default gen_random_uuid(),
  playbook_id         text not null
                        references public.framework_items(id) on delete cascade,
  upstream_output_id  uuid not null
                        references public.playbook_outputs(id) on delete cascade,
  position            int not null default 0,
  created_at          timestamptz not null default now(),
  -- A playbook can reference the same upstream output at most once. The
  -- editor enforces this client-side, but the constraint is the source of
  -- truth in case two tabs race.
  unique (playbook_id, upstream_output_id)
);

create index if not exists playbook_inputs_playbook_id_idx
  on public.playbook_inputs (playbook_id);

create index if not exists playbook_inputs_upstream_output_id_idx
  on public.playbook_inputs (upstream_output_id);

comment on table public.playbook_inputs is
  'Playbook-level input declarations: each row wires a playbook to an output of another playbook. Snapshotted into workflow_tasks.inputs[].upstreamOutputId on attach.';

alter table public.playbook_inputs enable row level security;

drop policy if exists "playbook_inputs: authenticated read"  on public.playbook_inputs;
drop policy if exists "playbook_inputs: authenticated write" on public.playbook_inputs;
create policy "playbook_inputs: authenticated read"
  on public.playbook_inputs for select to authenticated using (true);
create policy "playbook_inputs: authenticated write"
  on public.playbook_inputs for all to authenticated using (true) with check (true);

-- ---------------------------------------------------------------------------
-- Migrate existing workflow_tasks.inputs JSONB to the simplified shape.
-- Drop entries that don't reference an upstream output (the previous
-- `manual`/`bypass` modes). Strip the now-unused fields from the remaining
-- entries so on-read normalization stays simple.
-- ---------------------------------------------------------------------------
update public.workflow_tasks
   set inputs = coalesce(
     (
       select jsonb_agg(
         jsonb_build_object(
           'id',                i ->> 'id',
           'upstreamOutputId',  i ->> 'upstreamOutputId',
           'upstreamTaskRef',   i ->> 'upstreamTaskRef'
         )
       )
         from jsonb_array_elements(coalesce(inputs, '[]'::jsonb)) as i
        where (i ->> 'id') is not null
          and (i ->> 'upstreamOutputId') is not null
          and (i ->> 'upstreamOutputId') <> ''
     ),
     '[]'::jsonb
   )
 where inputs is not null
   and jsonb_typeof(inputs) = 'array';

-- ---------------------------------------------------------------------------
-- Same migration for the JSONB stored on workflow_templates.task_templates.
-- Each task template carries its own `inputs` array nested inside the
-- template-level `task_templates` JSONB.
-- ---------------------------------------------------------------------------
update public.workflow_templates
   set task_templates = coalesce(
     (
       select jsonb_agg(
         case
           when (tt ? 'inputs') and jsonb_typeof(tt -> 'inputs') = 'array' then
             tt || jsonb_build_object(
               'inputs',
               coalesce(
                 (
                   select jsonb_agg(
                     jsonb_build_object(
                       'id',                i ->> 'id',
                       'upstreamOutputId',  i ->> 'upstreamOutputId',
                       'upstreamTaskRef',   i ->> 'upstreamTaskRef'
                     )
                   )
                     from jsonb_array_elements(tt -> 'inputs') as i
                    where (i ->> 'id') is not null
                      and (i ->> 'upstreamOutputId') is not null
                      and (i ->> 'upstreamOutputId') <> ''
                 ),
                 '[]'::jsonb
               )
             )
           else tt
         end
       )
         from jsonb_array_elements(coalesce(task_templates, '[]'::jsonb)) as tt
     ),
     '[]'::jsonb
   )
 where task_templates is not null
   and jsonb_typeof(task_templates) = 'array';
