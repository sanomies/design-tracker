# Email notifications — operator guide

End-to-end setup for the transactional email pipeline. ~20 minutes of
clicking + DNS propagation. Run through this once per environment.

## What this ships

| Trigger | Template | DB hook |
|---|---|---|
| Task assigned to you | `task_assigned` | `notifications` INSERT, `type='assigned'` |
| Mentioned in a comment / task description | `comment_mention` | `notifications` INSERT, `type='mention'` |
| Reply / comment on a task you follow | `comment_reply` | `notifications` INSERT, `type='comment'` |
| Workspace invite with an email address | `workspace_invite` | `workspace_invitations` INSERT |

Plus:

- Per-user preferences UI at `/settings/email` (linked from the sidebar user menu).
- Token-based unsubscribe at `/unsubscribe?token=…&kind=…` (no login).
- `email_log` audit table with retry counts + Resend message IDs.
- Bounce / spam-complaint handler that flips `profile.email_status` so future
  sends to that address are skipped automatically.
- 3-attempt retry on Resend 5xx / 429 with 0.5s / 2s / 8s backoff.

## 1. Resend account + domain

1. Sign up at <https://resend.com/signup>.
2. **Domains → Add domain** → `onusano.com`. Add the MX / SPF (TXT) / DKIM (TXT)
   records Resend gives you wherever you manage onusano.com's DNS. Hit
   **Verify DNS** — should go green inside ~10 minutes.
3. **API Keys → Create API Key** → full access. Save the `re_…` value, you'll
   need it in step 3.

## 2. Push the migration

```bash
npx supabase db push
```

This creates:

- `email_preferences` (per-user opt-out booleans + unsubscribe token)
- `email_log` (delivery audit)
- `profiles.email_status` column (`ok` | `bounced` | `complained`)
- `dispatch_email()` function + triggers on `notifications` and
  `workspace_invitations`
- `unsubscribe_email()` RPC for token-based opt-out
- Two Vault entries (`send_email_url`, `send_email_secret`) with placeholder
  values — replaced in step 4.

## 3. Deploy the Edge Functions

```bash
# Generate a 32-byte hex secret to share between the DB trigger and the
# Edge Function. Keep this for step 4.
EDGE_SECRET=$(openssl rand -hex 32)
echo "Shared secret: $EDGE_SECRET"

# Set Edge Function env vars (per environment, not per function).
npx supabase secrets set \
  RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxx \
  EMAIL_FROM="Design Tracker <noreply@onusano.com>" \
  EDGE_SHARED_SECRET="$EDGE_SECRET" \
  APP_URL="https://onusano.com/design-tracker"

# Deploy both functions. --no-verify-jwt because the DB trigger and the
# Resend webhook both authenticate via custom headers, not user JWTs.
npx supabase functions deploy send-email --no-verify-jwt
npx supabase functions deploy resend-webhook --no-verify-jwt
```

Function URLs end up at:

```
https://<project-ref>.functions.supabase.co/send-email
https://<project-ref>.functions.supabase.co/resend-webhook
```

(Your project ref is in the Supabase dashboard URL.)

## 4. Update Vault secrets

In **Supabase Dashboard → Project Settings → Vault**, find:

- `send_email_url` — replace placeholder with
  `https://<project-ref>.functions.supabase.co/send-email`
- `send_email_secret` — replace placeholder with the `$EDGE_SECRET` value
  you generated in step 3 (must match `EDGE_SHARED_SECRET` exactly)

Until both are updated past their placeholder values, `dispatch_email()`
no-ops silently — no errors, just no emails. Useful for safe staging.

## 5. Configure the Resend webhook

In **Resend Dashboard → Webhooks → Add Endpoint**:

- **URL**: `https://<project-ref>.functions.supabase.co/resend-webhook`
- **Events**: `email.sent`, `email.delivered`, `email.bounced`, `email.complained`
- Save, copy the **Signing Secret** (starts with `whsec_…`).

Add it as another Edge Function secret:

```bash
npx supabase secrets set RESEND_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxx
```

Then redeploy the webhook function so it picks up the new env:

```bash
npx supabase functions deploy resend-webhook --no-verify-jwt
```

## 6. Smoke test

Pick whichever fits how the system is wired right now:

**End-to-end via the app** (best test):

1. Open `https://onusano.com/design-tracker/` and assign a task to your own
   user (using a second account, since the dispatch trigger skips
   self-actions).
2. The recipient address should receive `task_assigned` within a few seconds.
3. Check `email_log` in the SQL editor:
   ```sql
   select template, status, resend_message_id, error_message, retry_count, created_at
   from public.email_log
   order by created_at desc
   limit 20;
   ```

**Direct edge function poke** (isolates Resend integration from DB triggers):

```bash
curl -X POST 'https://<project-ref>.functions.supabase.co/send-email' \
  -H "X-Shared-Secret: $EDGE_SECRET" \
  -H 'Content-Type: application/json' \
  -d '{"kind":"notification","notification_id":"<paste a notification.id>"}'
```

A success response looks like `{"sent":true,"id":"re_msg_..."}`.

**Verify bounce handling**:

1. Resend's testing addresses simulate bounces — sign someone up with
   `bounced@resend.dev` then trigger a notification.
2. Within a few seconds the webhook fires; check
   `select email_status from profiles where id = '<that user>'` — should
   read `bounced`.
3. Trigger another notification for the same user — `email_log.status`
   should be `skipped` with `error_message = 'email_status=bounced'`.

## 7. Local development

Easiest path is to keep using the deployed Resend account during dev and
filter your logs by your own address. If you need fully offline testing:

```bash
# Run a local Supabase stack (includes Inbucket SMTP capture at :54324).
npx supabase start

# Serve the function locally with a .env file.
cat > supabase/functions/.env.local <<EOF
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxx
EMAIL_FROM=Design Tracker <noreply@onusano.com>
EDGE_SHARED_SECRET=local-dev-secret
APP_URL=http://localhost:5173/design-tracker
EOF

npx supabase functions serve send-email --env-file supabase/functions/.env.local --no-verify-jwt
```

Then POST to `http://localhost:54321/functions/v1/send-email` with the
same payload as in step 6.

## Operational notes

- **Rate limiting**: Resend free tier is 100/day, 3k/month. Beyond that
  you'll see HTTP 429 from Resend; the retry loop handles transient ones
  but sustained overage requires a paid plan.
- **Privacy**: `email_log.payload` and `error_message` may contain bits of
  comment text. The RLS policy restricts SELECT to `recipient_id =
  auth.uid()`, so each user only sees their own log rows.
- **Cost ceiling**: in pathological loops, a worst-case run could be 4
  emails per comment (mention + assignee + creator + thread participant).
  If volume becomes a concern, add a `select count(*) from email_log
  where created_at > now() - interval '1 hour'` rate-limit guard in
  `dispatch_email()`.
- **Re-running the migration**: idempotent. Triggers / policies all use
  `create or replace` / `drop trigger if exists`.
