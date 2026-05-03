-- Move ownership from the per-template Skill row (workflow_templates.skills /
-- workflow_instances.skills JSONB carrying `owners`) onto the Playbook itself
-- (framework_items.owners). The matrix Skill row now derives its owner stack
-- by aggregating owners across the playbooks assigned in that row, which
-- means the same skill can carry different owners in different rows when
-- different playbooks are at play.
--
-- This migration is additive: it adds the new column and best-effort backfills
-- it from the existing per-skill owners. The legacy `owners` field on the
-- JSONB skills array is left in place; the application reads through a
-- migration shim and stops writing it. A follow-up migration can drop the
-- legacy field once we're confident nothing reads it.

alter table public.framework_items
  add column if not exists owners jsonb not null default '[]'::jsonb;

-- Backfill: for each playbook, take the union of owners from every Skill row
-- (across all templates and instances) where that playbook is currently used.
-- We do this through workflow_tasks (instance assignments) and through the
-- task_templates JSONB (template assignments).
with playbook_skills as (
  -- Instance side: skill rows that currently host this playbook.
  select
    t.playbook_id as playbook_id,
    s.value->>'id' as skill_id,
    s.value->'owners' as owners
  from public.workflow_tasks t
  join public.workflow_instances i on i.id = t.instance_id
  cross join lateral jsonb_array_elements(coalesce(i.skills, '[]'::jsonb)) as s
  where t.playbook_id is not null
    and (s.value->>'id') = t.skill_id
    and jsonb_typeof(s.value->'owners') = 'array'

  union all

  -- Template side: skill rows in task_templates JSONB.
  select
    tpl->>'playbookId' as playbook_id,
    s.value->>'id' as skill_id,
    s.value->'owners' as owners
  from public.workflow_templates wt
  cross join lateral jsonb_array_elements(coalesce(wt.task_templates, '[]'::jsonb)) as tpl
  cross join lateral jsonb_array_elements(coalesce(wt.skills, '[]'::jsonb)) as s
  where (tpl->>'playbookId') is not null
    and (s.value->>'id') = (tpl->>'skillId')
    and jsonb_typeof(s.value->'owners') = 'array'
),
playbook_owner_union as (
  select
    playbook_id,
    jsonb_agg(distinct owner) filter (where owner is not null) as owners
  from playbook_skills
  cross join lateral jsonb_array_elements_text(owners) as owner
  group by playbook_id
)
update public.framework_items fi
   set owners = pou.owners
  from playbook_owner_union pou
 where fi.id = pou.playbook_id
   and fi.type = 'playbook'
   and (fi.owners is null or fi.owners = '[]'::jsonb)
   and pou.owners is not null;

comment on column public.framework_items.owners is
  'Owner labels (people or AI agents) responsible for this playbook. Only meaningful for type=''playbook''. The matrix Skill row derives its owner stack by union-ing owners from all playbooks assigned in that row.';
