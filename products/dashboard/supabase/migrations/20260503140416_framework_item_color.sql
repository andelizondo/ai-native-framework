-- Add per-item color to framework_items so Skills and Playbooks have a
-- user-chosen identity color. The matrix and avatars derive their color from
-- this field instead of the previous id-hash fallback (lib/workflows/skill-colors.ts).
alter table public.framework_items
  add column if not exists color text;
