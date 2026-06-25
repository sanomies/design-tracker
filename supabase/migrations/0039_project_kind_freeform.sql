-- Project kinds now proliferate (marketing, product, reklaam, events,
-- editorial, …) and each is just a key into a catalog profile defined in
-- the frontend. Drop the CHECK constraint so adding a new kind is a
-- code-only change (no migration) — the column stays plain text with a
-- 'marketing' default, and the app validates the value via the project
-- dialog's selector. Unknown values fall back to the marketing profile.

alter table public.projects
  drop constraint if exists projects_kind_check;
