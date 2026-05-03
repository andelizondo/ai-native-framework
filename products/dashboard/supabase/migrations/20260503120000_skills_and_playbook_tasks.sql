-- Rename matrix Roles to Skills, simplify Tasks to playbook references, and
-- introduce a many-to-many "allowed skills" relation per playbook.
--
-- Background: the matrix row concept is being unified with the existing Skills
-- framework library (framework_items.type = 'skill'). Tasks become "a playbook
-- applied to a skill at a stage" — title/description/agent/skill move off the
-- task in favor of the linked playbook + the parent skill row.

-- ---------------------------------------------------------------------------
-- 1. Roles -> Skills column renames
-- ---------------------------------------------------------------------------
alter table public.workflow_templates rename column roles to skills;
alter table public.workflow_instances rename column roles to skills;
alter table public.workflow_tasks     rename column role_id to skill_id;

-- ---------------------------------------------------------------------------
-- 2. Drop task content fields now derived from the linked playbook + skill
--    row, and add a per-task `notes` field for instance-specific context.
-- ---------------------------------------------------------------------------
alter table public.workflow_tasks
  drop column if exists title,
  drop column if exists description,
  drop column if exists agent,
  drop column if exists skill;

alter table public.workflow_tasks
  add column if not exists notes text not null default '';

-- ---------------------------------------------------------------------------
-- 3. Rename `playbook` -> `playbook_id` and link it to framework_items.
--    Drop orphan rows first so the FK can be added cleanly.
-- ---------------------------------------------------------------------------
alter table public.workflow_tasks rename column playbook to playbook_id;

delete from public.workflow_tasks t
 where t.playbook_id is not null
   and not exists (
     select 1 from public.framework_items fi
      where fi.id = t.playbook_id and fi.type = 'playbook'
   );

alter table public.workflow_tasks
  add constraint workflow_tasks_playbook_id_fkey
    foreign key (playbook_id)
    references public.framework_items(id)
    on delete set null;

-- ---------------------------------------------------------------------------
-- 4. Rewrite task_templates JSONB on workflow_templates to the new shape:
--    drop title/desc/agent/skill, rename role->skillId, playbook->playbookId,
--    add notes (empty by default).
-- ---------------------------------------------------------------------------
update public.workflow_templates
   set task_templates = (
     select coalesce(jsonb_agg(
       jsonb_build_object(
         'id',         tpl->>'id',
         'skillId',    coalesce(tpl->>'skillId', tpl->>'role'),
         'stageId',    coalesce(tpl->>'stageId', tpl->>'stage'),
         'playbookId', coalesce(tpl->>'playbookId', tpl->>'playbook'),
         'notes',      coalesce(tpl->>'notes', ''),
         'checkpoint', coalesce((tpl->>'checkpoint')::boolean, false),
         'triggers',   coalesce(tpl->'triggers', '[]'::jsonb),
         'gates',      coalesce(tpl->'gates', '[]'::jsonb)
       )
     ), '[]'::jsonb)
     from jsonb_array_elements(task_templates) as tpl
   )
 where jsonb_typeof(task_templates) = 'array';

-- ---------------------------------------------------------------------------
-- 5. Allowed-skills join table for playbooks.
--    Many-to-many between framework_items (type='playbook') and
--    framework_items (type='skill'). Foreign keys cascade so deleting either
--    side auto-cleans the join. Row-type guarantees are enforced application
--    side; we keep the schema tolerant to avoid trigger plumbing for V1.
-- ---------------------------------------------------------------------------
create table if not exists public.framework_item_allowed_skills (
  playbook_id text not null references public.framework_items(id) on delete cascade,
  skill_id    text not null references public.framework_items(id) on delete cascade,
  primary key (playbook_id, skill_id)
);

create index if not exists framework_item_allowed_skills_skill_idx
  on public.framework_item_allowed_skills (skill_id);

comment on table public.framework_item_allowed_skills is
  'Which Skills are allowed to use a given Playbook. Drives the playbook picker on a matrix cell.';

alter table public.framework_item_allowed_skills enable row level security;

drop policy if exists "framework_item_allowed_skills: authenticated read"  on public.framework_item_allowed_skills;
drop policy if exists "framework_item_allowed_skills: authenticated write" on public.framework_item_allowed_skills;
create policy "framework_item_allowed_skills: authenticated read"
  on public.framework_item_allowed_skills for select to authenticated using (true);
create policy "framework_item_allowed_skills: authenticated write"
  on public.framework_item_allowed_skills for all     to authenticated using (true) with check (true);
