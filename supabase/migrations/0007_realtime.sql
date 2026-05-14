-- 0007_realtime.sql — enable Supabase Realtime for the tables the client
-- subscribes to. Supabase reads the `supabase_realtime` publication and
-- broadcasts INSERT/UPDATE/DELETE events on its member tables. RLS is still
-- applied per-subscriber, so users only receive events for rows they can
-- read.

alter publication supabase_realtime add table public.tasks;
alter publication supabase_realtime add table public.comments;
alter publication supabase_realtime add table public.attachments;
alter publication supabase_realtime add table public.projects;
alter publication supabase_realtime add table public.workspace_members;
