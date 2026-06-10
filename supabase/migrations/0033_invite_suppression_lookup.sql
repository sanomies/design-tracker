-- 0033_invite_suppression_lookup.sql — let send-email honor a recipient's
-- bounce/complaint state and invite opt-out before sending an invitation.
--
-- Finding B (audit v2), suppression half: send-email's loadInvitationContext
-- hardcodes emailStatus='ok' and notify_invite=true (fakePrefs), so invitation
-- emails ignore the recipient's profile.email_status ('bounced'/'complained')
-- and their email_preferences.notify_invite opt-out. Repeatedly emailing a
-- hard-bounced or complained address harms the sending domain's reputation,
-- and an opted-out user keeps getting invites.
--
-- This helper resolves an email to an existing account and returns true if
-- that account should NOT be sent invite mail. New invitees (no account yet)
-- have nothing to suppress and return false — the invite flow still works.
--
-- Locked down to service_role ONLY: the send-email Edge Function (which runs
-- with the service-role key) is the sole caller. It is deliberately NOT
-- granted to anon/authenticated — exposing it there would be an
-- email-registration + suppression-state enumeration oracle.

create or replace function public.invite_email_suppressed(_email text)
returns boolean
language sql
security definer
set search_path = public, auth
stable
as $$
  select exists (
    select 1
    from auth.users u
    join public.profiles p on p.id = u.id
    left join public.email_preferences ep on ep.user_id = u.id
    where lower(u.email) = lower(trim(_email))
      and (p.email_status <> 'ok' or coalesce(ep.notify_invite, true) = false)
  );
$$;

revoke all on function public.invite_email_suppressed(text) from public;
grant execute on function public.invite_email_suppressed(text) to service_role;
