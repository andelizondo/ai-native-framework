-- Template ↔ instance lineage + last-synced marker.
--
-- Today an instance task only knows its `instance_id`; the path back to the
-- originating `task_templates[].id` is recovered by `createInstance` via a
-- composite key. Since the multi-card matrix change (PR #233) cells can
-- carry more than one card, so `(skill_id, stage_id)` alone is no longer
-- unique within a template — the remap now prefers
-- `(skill_id, stage_id, playbook_id)` with ordinal as a final tiebreaker.
-- Implicit recovery works for fresh creates, but it can't distinguish
-- "this cell was always here" from "this cell was added later", and goes
-- stale the moment we want a stable handle for template-level rollup or
-- sync diffing.
--
-- This migration makes the lineage explicit:
--   * `workflow_tasks.template_task_id` (nullable — ad-hoc tasks created on
--     an instance via createTask have no template counterpart)
--   * `workflow_instances.template_synced_at` (nullable — null on instances
--     that have never been touched by sync; set by createInstance for new
--     instances and by applyTemplateSync going forward)
--
-- Backfill: for every existing task, look up the parent instance's
-- task_templates and prefer matches on (skill_id, stage_id, playbook_id).
-- When multi-card cells share the same triplet, fall back to ordinal
-- pairing within the cell (Nth task at that cell ↔ Nth task_template
-- entry at that cell). Any task whose cell doesn't match a current
-- template entry stays NULL — those are ad-hoc rows or tasks whose
-- template counterpart was already removed.

alter table public.workflow_tasks
  add column if not exists template_task_id text;

create index if not exists workflow_tasks_template_task_id_idx
  on public.workflow_tasks (instance_id, template_task_id);

alter table public.workflow_instances
  add column if not exists template_synced_at timestamptz;

-- Backfill template_task_id for existing rows.
--
-- The CTE computes a per-cell ordinal on both sides so multi-card cells
-- pair Nth-with-Nth instead of collapsing onto a single template task. The
-- match is then a single equi-join on
-- (instance_id, skill_id, stage_id, playbook_id, ordinal). Rows whose cell
-- triplet doesn't exist on the template are left NULL on purpose.
with template_cards as (
  select
    i.id                       as instance_id,
    (tpl->>'skillId')          as skill_id,
    (tpl->>'stageId')          as stage_id,
    nullif(tpl->>'playbookId', '') as playbook_id,
    coalesce(
      nullif(tpl->>'id', ''),
      format('%s::%s::%s::%s',
             wt.id,
             (tpl->>'skillId'),
             (tpl->>'stageId'),
             (tpl_idx::int - 1))
    )                          as template_task_id,
    row_number() over (
      partition by i.id,
                   (tpl->>'skillId'),
                   (tpl->>'stageId'),
                   nullif(tpl->>'playbookId', '')
      order by tpl_idx
    )                          as cell_ord
  from public.workflow_instances i
  join public.workflow_templates wt on wt.id = i.template_id
  cross join lateral jsonb_array_elements(coalesce(wt.task_templates, '[]'::jsonb))
                     with ordinality as arr(tpl, tpl_idx)
),
instance_cards as (
  select
    tt.id          as task_id,
    tt.instance_id,
    tt.skill_id,
    tt.stage_id,
    tt.playbook_id,
    row_number() over (
      partition by tt.instance_id, tt.skill_id, tt.stage_id, tt.playbook_id
      order by tt.created_at, tt.id
    )              as cell_ord
  from public.workflow_tasks tt
  where tt.template_task_id is null
)
update public.workflow_tasks t
   set template_task_id = m.template_task_id
  from instance_cards ic
  join template_cards m
    on m.instance_id = ic.instance_id
   and m.skill_id    = ic.skill_id
   and m.stage_id    = ic.stage_id
   and m.playbook_id is not distinct from ic.playbook_id
   and m.cell_ord    = ic.cell_ord
 where t.id = ic.task_id;

-- Initialize template_synced_at to created_at on existing instances so the
-- sync drawer reads "Last synced <created time>" instead of null — they're
-- in sync at the moment they were created by definition.
update public.workflow_instances
   set template_synced_at = created_at
 where template_synced_at is null;

comment on column public.workflow_tasks.template_task_id is
  'Lineage back to workflow_templates.task_templates[].id. Null for ad-hoc instance tasks (createTask) with no template counterpart. Drives the sync drawer diff and the template-level matrix rollup.';

comment on column public.workflow_instances.template_synced_at is
  'Last time the instance was reconciled with its template via applyTemplateSync (or created, for fresh instances). Surfaces "Last synced" in the sync drawer.';
