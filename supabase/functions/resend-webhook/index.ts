// resend-webhook — receives Resend's delivery events and updates the user's
// profile.email_status when an address bounces or complains. Future emails
// to that recipient will then be skipped by send-email.
//
// Required env vars:
//   RESEND_WEBHOOK_SECRET — Svix signing secret (starts with whsec_...)
//
// Deploy: supabase functions deploy resend-webhook --no-verify-jwt
//
// Configure in Resend Dashboard → Webhooks → Add Endpoint:
//   URL:    https://<project-ref>.functions.supabase.co/resend-webhook
//   Events: email.bounced, email.complained (others optional)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

function env(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

const supabase = createClient(
  env("SUPABASE_URL"),
  env("SUPABASE_SERVICE_ROLE_KEY"),
  { auth: { persistSession: false } },
);

// Svix signature verification — HMAC-SHA256 of `${id}.${timestamp}.${body}`
// keyed by the webhook secret (the part after "whsec_" base64-decoded).
async function verifySignature(
  svixId: string,
  svixTimestamp: string,
  svixSignature: string,
  body: string,
): Promise<boolean> {
  const rawSecret = env("RESEND_WEBHOOK_SECRET").replace(/^whsec_/, "");
  let keyBytes: Uint8Array;
  try {
    keyBytes = Uint8Array.from(atob(rawSecret), (c) => c.charCodeAt(0));
  } catch {
    return false;
  }
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const toSign = new TextEncoder().encode(`${svixId}.${svixTimestamp}.${body}`);
  const sigBuf = await crypto.subtle.sign("HMAC", key, toSign);
  const expected = btoa(String.fromCharCode(...new Uint8Array(sigBuf)));

  // svix-signature header format: "v1,<sig1> v1,<sig2> ..." — any match is valid.
  return svixSignature
    .split(" ")
    .map((part) => part.split(",")[1])
    .some((sig) => sig === expected);
}

type ResendEvent = {
  type: string;
  data: {
    email_id?: string;
    to?: string | string[];
  };
};

Deno.serve(async (req) => {
  const svixId = req.headers.get("svix-id");
  const svixTimestamp = req.headers.get("svix-timestamp");
  const svixSignature = req.headers.get("svix-signature");
  if (!svixId || !svixTimestamp || !svixSignature) {
    return new Response("Missing svix headers", { status: 400 });
  }

  const body = await req.text();
  const valid = await verifySignature(svixId, svixTimestamp, svixSignature, body);
  if (!valid) return new Response("Invalid signature", { status: 401 });

  let event: ResendEvent;
  try {
    event = JSON.parse(body) as ResendEvent;
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }

  const status = event.type === "email.bounced" ? "bounced"
    : event.type === "email.complained" ? "complained"
    : null;

  // Look up the email_log row to find the recipient_id we already recorded
  // when sending. Avoids scanning auth.users on every bounce.
  let recipientId: string | null = null;
  if (event.data.email_id) {
    const { data: logRow } = await supabase
      .from("email_log")
      .select("recipient_id")
      .eq("resend_message_id", event.data.email_id)
      .maybeSingle();
    recipientId = logRow?.recipient_id ?? null;

    const logStatus = status === "bounced" ? "bounced"
      : status === "complained" ? "complained"
      : event.type === "email.delivered" ? "sent"
      : null;
    if (logStatus) {
      await supabase
        .from("email_log")
        .update({ status: logStatus, updated_at: new Date().toISOString() })
        .eq("resend_message_id", event.data.email_id);
    }
  }

  // Only bounce/complaint events flip profile.email_status.
  if (status && recipientId) {
    await supabase
      .from("profiles")
      .update({ email_status: status })
      .eq("id", recipientId);
  }

  return new Response("OK", { status: 200 });
});
