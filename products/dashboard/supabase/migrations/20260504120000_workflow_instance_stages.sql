-- Snapshot stages onto each workflow instance, mirroring the existing
-- snapshot of `skills`. Templates become true blueprints: edits to a
-- template's stages no longer mutate existing instances (which would
-- silently orphan tasks whose `stage_id` no longer matched any column).
--
-- Backfill copies the parent template's current stages into every
-- existing instance, preserving the current visible state at the moment
-- of migration.

alter table public.workflow_instances
  add column if not exists stages jsonb not null default '[]'::jsonb;

update public.workflow_instances i
   set stages = t.stages
  from public.workflow_templates t
 where i.template_id = t.id
   and i.stages = '[]'::jsonb;

comment on column public.workflow_instances.stages is
  'Snapshot of the parent template''s stages at instance-create time. '
  'Decoupled from workflow_templates.stages so template edits do not '
  'mutate existing instances or orphan their workflow_tasks rows.';
