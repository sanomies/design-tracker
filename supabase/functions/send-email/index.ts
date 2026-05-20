// send-email — Edge Function called by the dispatch_email() Postgres trigger.
//
// Required env vars (set via `supabase secrets set <KEY>=<VALUE>`):
//   RESEND_API_KEY       — Resend API key (re_...)
//   EMAIL_FROM           — e.g. "Design Tracker <noreply@onusano.com>"
//   EDGE_SHARED_SECRET   — must equal the vault `send_email_secret` value
//   APP_URL              — e.g. "https://onusano.com/design-tracker"
//
// Auto-provided by Supabase (no setup needed):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//
// Deploy: supabase functions deploy send-email --no-verify-jwt
// (--no-verify-jwt because the caller is the DB trigger, authed via the
//  X-Shared-Secret header instead of a user JWT.)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import type {
  DispatchPayload,
  EmailPreferences,
  EmailTemplate,
  TemplateVars,
} from "../_shared/types.ts";
import { renderTemplate, htmlToText } from "../_shared/templates.ts";

const MAX_RETRIES = 3;
const RETRY_DELAYS_MS = [500, 2000, 8000];

function env(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function buildAppUrl(path: string): string {
  const base = env("APP_URL").replace(/\/$/, "");
  return `${base}${path.startsWith("/") ? path : "/" + path}`;
}

const supabase = createClient(
  env("SUPABASE_URL"),
  env("SUPABASE_SERVICE_ROLE_KEY"),
  { auth: { persistSession: false } },
);

type NotificationContext = {
  recipientEmail: string;
  recipientName: string | null;
  recipientId: string;
  prefs: EmailPreferences;
  emailStatus: string;
  template: EmailTemplate | null; // null = skip
  vars: TemplateVars;
};

async function loadAuthUserEmail(userId: string): Promise<string | null> {
  const { data, error } = await supabase.auth.admin.getUserById(userId);
  if (error || !data?.user?.email) return null;
  return data.user.email;
}

async function loadNotificationContext(notificationId: string): Promise<NotificationContext | null> {
  const { data: n, error } = await supabase
    .from("notifications")
    .select("id, recipient_id, actor_id, type, task_id, comment_id, data")
    .eq("id", notificationId)
    .single();
  if (error || !n) return null;

  const { data: recipient } = await supabase
    .from("profiles")
    .select("id, full_name, email_status")
    .eq("id", n.recipient_id)
    .single();
  if (!recipient) return null;

  const { data: prefs } = await supabase
    .from("email_preferences")
    .select("*")
    .eq("user_id", n.recipient_id)
    .single();
  if (!prefs) return null;

  const recipientEmail = await loadAuthUserEmail(n.recipient_id);
  if (!recipientEmail) return null;

  const actorName = n.actor_id
    ? (await supabase.from("profiles").select("full_name").eq("id", n.actor_id).single())
        .data?.full_name ?? "Someone"
    : "Someone";

  let taskTitle = "a task";
  let commentPreview: string | undefined;
  if (n.task_id) {
    const { data: task } = await supabase
      .from("tasks")
      .select("title")
      .eq("id", n.task_id)
      .single();
    if (task) taskTitle = task.title;
  }
  if (n.comment_id) {
    const { data: comment } = await supabase
      .from("comments")
      .select("body")
      .eq("id", n.comment_id)
      .single();
    if (comment) commentPreview = htmlToText(comment.body, 240);
  }

  let template: EmailTemplate | null = null;
  if (n.type === "assigned" && prefs.notify_assigned) template = "task_assigned";
  else if (n.type === "mention" && prefs.notify_mention) template = "comment_mention";
  else if (n.type === "comment" && prefs.notify_comment) template = "comment_reply";

  const vars: TemplateVars = {
    recipient_name: recipient.full_name,
    actor_name: actorName,
    task_title: taskTitle,
    task_url: buildAppUrl(n.task_id ? `/?task=${n.task_id}` : "/"),
    comment_preview: commentPreview,
    unsubscribe_url: buildAppUrl(`/unsubscribe?token=${prefs.unsubscribe_token}&kind=all`),
    manage_prefs_url: buildAppUrl("/settings/email"),
  };

  return {
    recipientEmail,
    recipientName: recipient.full_name,
    recipientId: recipient.id,
    prefs,
    emailStatus: recipient.email_status,
    template,
    vars,
  };
}

async function loadInvitationContext(invitationId: string): Promise<NotificationContext | null> {
  const { data: inv } = await supabase
    .from("workspace_invitations")
    .select("id, workspace_id, invited_email, token, created_by")
    .eq("id", invitationId)
    .single();
  if (!inv || !inv.invited_email) return null;

  const { data: ws } = await supabase
    .from("workspaces")
    .select("name")
    .eq("id", inv.workspace_id)
    .single();

  const actorName = inv.created_by
    ? (await supabase.from("profiles").select("full_name").eq("id", inv.created_by).single())
        .data?.full_name ?? "Someone"
    : "Someone";

  // Recipient may not be a Profile yet (signing up for the first time). We
  // still need a preferences row for the unsubscribe link — fall back to the
  // invitation's own token doubling as the unsub identifier.
  const fakePrefs: EmailPreferences = {
    user_id: "00000000-0000-0000-0000-000000000000",
    notify_assigned: true,
    notify_mention: true,
    notify_comment: true,
    notify_invite: true,
    unsubscribe_token: inv.token,
  };

  const vars: TemplateVars = {
    recipient_name: null,
    actor_name: actorName,
    task_title: ws?.name ?? "a workspace",
    task_url: buildAppUrl("/"),
    workspace_name: ws?.name ?? undefined,
    invite_url: buildAppUrl(`/invite/${inv.token}`),
    unsubscribe_url: buildAppUrl(`/unsubscribe?token=${inv.token}&kind=invite`),
    manage_prefs_url: buildAppUrl("/settings/email"),
  };

  return {
    recipientEmail: inv.invited_email,
    recipientName: null,
    recipientId: "00000000-0000-0000-0000-000000000000",
    prefs: fakePrefs,
    emailStatus: "ok",
    template: "workspace_invite",
    vars,
  };
}

type ResendSendResult = {
  ok: boolean;
  status: number;
  messageId?: string;
  error?: string;
};

async function sendViaResend(
  to: string,
  subject: string,
  html: string,
  text: string,
  vars: TemplateVars,
  template: EmailTemplate,
): Promise<ResendSendResult> {
  const headers: Record<string, string> = {
    "List-Unsubscribe": `<${vars.unsubscribe_url}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env("RESEND_API_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env("EMAIL_FROM"),
      to,
      subject,
      html,
      text,
      headers,
      tags: [{ name: "template", value: template }],
    }),
  });
  const status = res.status;
  if (status >= 200 && status < 300) {
    const body = await res.json().catch(() => ({}));
    return { ok: true, status, messageId: body?.id };
  }
  const errBody = await res.text().catch(() => "");
  return { ok: false, status, error: errBody.slice(0, 1000) };
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function logEmail(row: {
  recipient_id: string | null;
  template: string;
  status: "queued" | "sent" | "failed" | "skipped";
  resend_message_id?: string;
  notification_id?: string;
  invitation_id?: string;
  payload?: Record<string, unknown>;
  error_message?: string;
  retry_count: number;
}): Promise<void> {
  const recipientId = row.recipient_id === "00000000-0000-0000-0000-000000000000"
    ? null
    : row.recipient_id;
  await supabase.from("email_log").insert({
    recipient_id: recipientId,
    template: row.template,
    status: row.status,
    resend_message_id: row.resend_message_id ?? null,
    notification_id: row.notification_id ?? null,
    invitation_id: row.invitation_id ?? null,
    payload: row.payload ?? null,
    error_message: row.error_message ?? null,
    retry_count: row.retry_count,
  });
}

Deno.serve(async (req) => {
  // 1. Auth check.
  const sharedSecret = req.headers.get("X-Shared-Secret");
  if (!sharedSecret || sharedSecret !== env("EDGE_SHARED_SECRET")) {
    return new Response("Unauthorized", { status: 401 });
  }

  // 2. Parse payload.
  let payload: DispatchPayload;
  try {
    payload = (await req.json()) as DispatchPayload;
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  // 3. Resolve context.
  const ctx = payload.kind === "notification"
    ? await loadNotificationContext(payload.notification_id)
    : await loadInvitationContext(payload.invitation_id);

  const refId = payload.kind === "notification"
    ? { notification_id: payload.notification_id }
    : { invitation_id: payload.invitation_id };

  if (!ctx) {
    // The referenced row doesn't exist (race condition) or recipient
    // can't be resolved. Log and return 200 so pg_net doesn't retry.
    await logEmail({
      recipient_id: null,
      template: "unknown",
      status: "skipped",
      ...refId,
      payload: payload as unknown as Record<string, unknown>,
      error_message: "context not resolvable",
      retry_count: 0,
    });
    return new Response(JSON.stringify({ skipped: "no context" }), { status: 200 });
  }

  // 4. Opt-out and bounce checks.
  if (ctx.template === null) {
    await logEmail({
      recipient_id: ctx.recipientId,
      template: "opt_out",
      status: "skipped",
      ...refId,
      error_message: "recipient opted out",
      retry_count: 0,
    });
    return new Response(JSON.stringify({ skipped: "opt_out" }), { status: 200 });
  }
  if (ctx.emailStatus !== "ok") {
    await logEmail({
      recipient_id: ctx.recipientId,
      template: ctx.template,
      status: "skipped",
      ...refId,
      error_message: `email_status=${ctx.emailStatus}`,
      retry_count: 0,
    });
    return new Response(JSON.stringify({ skipped: ctx.emailStatus }), { status: 200 });
  }

  // 5. Render and send with retry.
  const rendered = renderTemplate(ctx.template, ctx.vars);
  let lastErr = "";
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const result = await sendViaResend(
      ctx.recipientEmail,
      rendered.subject,
      rendered.html,
      rendered.text,
      ctx.vars,
      ctx.template,
    );
    if (result.ok) {
      await logEmail({
        recipient_id: ctx.recipientId,
        template: ctx.template,
        status: "sent",
        resend_message_id: result.messageId,
        ...refId,
        retry_count: attempt,
      });
      return new Response(JSON.stringify({ sent: true, id: result.messageId }), { status: 200 });
    }
    lastErr = `status=${result.status} ${result.error ?? ""}`;
    // Only retry on 5xx / 429. 4xx errors won't fix themselves.
    if (result.status < 500 && result.status !== 429) break;
    if (attempt < MAX_RETRIES - 1) await sleep(RETRY_DELAYS_MS[attempt]);
  }

  await logEmail({
    recipient_id: ctx.recipientId,
    template: ctx.template,
    status: "failed",
    ...refId,
    error_message: lastErr,
    retry_count: MAX_RETRIES,
  });
  return new Response(JSON.stringify({ sent: false, error: lastErr }), { status: 200 });
});
