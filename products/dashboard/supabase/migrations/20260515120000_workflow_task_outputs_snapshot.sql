-- ---------------------------------------------------------------------------
-- Per-task outputs snapshot (AEL-XXX).
--
-- The previous model fetched a task's outputs directly from
-- `playbook_outputs` (the playbook definition) every time a card or drawer
-- rendered. Removing an output from the definition cascade-deleted produced
-- task_outputs everywhere; there was no way to opt a single task out of an
-- output the playbook would otherwise force on it.
--
-- This migration moves to a snapshot model:
--   * `workflow_tasks.outputs jsonb` carries a per-task copy of the
--     playbook's outputs at attach time. Edits (remove, reorder) on the
--     snapshot do NOT propagate back to the definition.
--   * The `task_outputs.output_id -> playbook_outputs.id` FK is dropped so
--     definition-side deletes no longer cascade-wipe per-task state. Snapshot
--     ids equal the source `playbook_outputs.id` so the produce-flow upsert
--     on `(task_id, output_id)` keeps working.
--   * Existing tasks are backfilled from `playbook_outputs` so reads stay
--     consistent across the cutover.
--   * `workflow_templates.task_templates` is already JSONB; rows are
--     backfilled in-place so each task template carries its own snapshot.
-- ---------------------------------------------------------------------------

-- 1. Snapshot column on workflow_tasks. Defaults to '[]' so callers that
--    haven't been updated yet still see a usable shape.
alter table public.workflow_tasks
  add column if not exists outputs jsonb not null default '[]'::jsonb;

comment on column public.workflow_tasks.outputs is
  'Per-task snapshot of the playbook''s outputs at attach time. JSON array of PlaybookOutput shape: {id, playbookId, name, description, kind, apiCheck, position, createdAt}. Editing this list does not propagate to playbook_outputs.';

-- 2. Backfill existing rows from the live playbook_outputs.
update public.workflow_tasks t
   set outputs = coalesce((
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
        where po.playbook_id = t.playbook_id
   ), '[]'::jsonb)
 where t.playbook_id is not null
   and (t.outputs is null or t.outputs = '[]'::jsonb);

-- 3. Backfill task_templates JSONB array on workflow_templates: for each
--    task template object that has a playbookId, attach a sibling
--    `outputs` array snapshotted from the live playbook_outputs.
update public.workflow_templates wt
   set task_templates = sub.next_task_templates
  from (
    select
      wt2.id as template_id,
      coalesce(
        jsonb_agg(
          case
            when (task_def ->> 'playbookId') is not null
              and not (task_def ? 'outputs')
            then task_def || jsonb_build_object(
              'outputs',
              coalesce((
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
                 where po.playbook_id = (task_def ->> 'playbookId')
              ), '[]'::jsonb)
            )
            else task_def
          end
          order by ordinality
        ),
        '[]'::jsonb
      ) as next_task_templates
    from public.workflow_templates wt2,
         jsonb_array_elements(coalesce(wt2.task_templates, '[]'::jsonb))
           with ordinality as t(task_def, ordinality)
    group by wt2.id
  ) as sub
 where wt.id = sub.template_id;

-- 4. Relax the cascade FK on task_outputs.output_id. Snapshot ids are no
--    longer guaranteed to exist in playbook_outputs (the definition row may
--    be deleted while the snapshot lives on), so the FK + cascade rule has
--    to go. The unique (task_id, output_id) constraint stays — produce-flow
--    upserts depend on it.
alter table public.task_outputs
  drop constraint if exists task_outputs_output_id_fkey;

comment on column public.task_outputs.output_id is
  'Soft reference to the snapshot output id on workflow_tasks.outputs. Equals the source playbook_outputs.id at snapshot time but no longer FK-enforced — definition-side deletes do not cascade here.';
