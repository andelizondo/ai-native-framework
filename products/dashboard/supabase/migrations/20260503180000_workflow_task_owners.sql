-- Move ownership onto each matrix card (workflow_tasks). Owners previously
-- lived on the per-template/instance Skill row JSONB (workflow_templates.skills
-- / workflow_instances.skills, carrying `owners`), which forced every card in
-- the same skill row — and every card sharing a playbook across instances —
-- to share an owner list. They now belong to the task itself, so the same
-- template can carry the same default owners while individual instances
-- reassign per-card (e.g. a different sales person per deal).
--
-- The matrix Skill row's owner stack is derived at render time by union-ing
-- owners across the cards currently sitting in that row.
--
-- Backfill source: the legacy per-skill `owners` JSON in workflow_instances.skills.
-- For each task we copy the owner list from the skill row that hosts it, so
-- live instances do not blank their owner stacks. The legacy field on the
-- JSONB skills array is left in place; the application reads through a
-- migration shim and stops writing it. A follow-up migration can drop the
-- legacy field once we're confident nothing reads it.

alter table public.workflow_tasks
  add column if not exists owners jsonb not null default '[]'::jsonb;

with task_skill_owners as (
  select
    t.id as task_id,
    s.value->'owners' as owners
  from public.workflow_tasks t
  join public.workflow_instances i on i.id = t.instance_id
  cross join lateral jsonb_array_elements(coalesce(i.skills, '[]'::jsonb)) as s
  where (s.value->>'id') = t.skill_id
    and jsonb_typeof(s.value->'owners') = 'array'
    and jsonb_array_length(s.value->'owners') > 0
)
update public.workflow_tasks t
   set owners = tso.owners
  from task_skill_owners tso
 where t.id = tso.task_id
   and (t.owners is null or t.owners = '[]'::jsonb);

comment on column public.workflow_tasks.owners is
  'Owner labels (people or AI agents) responsible for this task. The matrix Skill row derives its owner stack by union-ing owners across the tasks currently sitting in that row.';
