-- Projects carry a "kind" that selects which catalog a project uses:
--   'marketing' -> "Brand" picker + the brand catalog + marketing task types
--   'product'   -> "Product" picker + the product catalog + product task types
--
-- Every existing project defaults to 'marketing', so nothing changes in the
-- app until a project is explicitly switched to 'product' from the Edit
-- Project dialog. The column is plain text guarded by a CHECK constraint so
-- adding a future kind is a one-line constraint change, not a type migration.

alter table public.projects
  add column if not exists kind text not null default 'marketing';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'projects_kind_check'
  ) then
    alter table public.projects
      add constraint projects_kind_check check (kind in ('marketing', 'product'));
  end if;
end $$;
