// Branded email templates — inline-styled HTML + plain-text fallback.
//
// Design tokens mirror src/index.css:
//   background  #f6f6f5
//   card        #ffffff with #d6d9de border, 8px radius
//   heading     #0a0d12
//   body        #52576a
//   muted       #8a8f9d
//   button      #0a0d12 bg, #ffffff fg, 8px radius
//   font-stack  system fonts (web fonts don't render reliably in email)

import type { EmailTemplate, RenderedEmail, TemplateVars } from "./types.ts";

const FONT_STACK =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Strip HTML tags + collapse whitespace for the plain-text fallback and the
// comment preview snippet. Mention chips become plain "@Name".
function htmlToText(html: string | null | undefined, maxLen = 280): string {
  if (!html) return "";
  const stripped = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return stripped.length > maxLen ? stripped.slice(0, maxLen - 1) + "…" : stripped;
}

function shell(opts: {
  preheader: string;
  heading: string;
  intro: string;
  ctaLabel: string;
  ctaUrl: string;
  detailBlock?: string;
  footnote?: string;
  vars: TemplateVars;
}): string {
  const { preheader, heading, intro, ctaLabel, ctaUrl, detailBlock, footnote, vars } = opts;
  return `<!doctype html>
<html lang="en">
<body style="margin:0;padding:0;background:#f6f6f5;">
  <span style="display:none !important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;font-size:1px;line-height:1px;mso-hide:all;">${escape(preheader)}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f6f5;padding:48px 16px;font-family:${FONT_STACK};">
    <tr><td align="center">
      <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background:#ffffff;border:1px solid #d6d9de;border-radius:8px;">
        <tr><td style="padding:40px 40px 32px;">
          <p style="margin:0 0 28px;font-size:12px;font-weight:600;letter-spacing:0.06em;color:#0a0d12;text-transform:uppercase;">Design Tracker</p>
          <h1 style="margin:0 0 12px;font-size:20px;font-weight:600;line-height:1.35;color:#0a0d12;">${escape(heading)}</h1>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.55;color:#52576a;">${intro}</p>
          ${detailBlock ?? ""}
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 0;">
            <tr><td style="background:#0a0d12;border-radius:8px;">
              <a href="${ctaUrl}" style="display:inline-block;padding:11px 20px;font-size:14px;font-weight:500;color:#ffffff;text-decoration:none;font-family:${FONT_STACK};">${escape(ctaLabel)}</a>
            </td></tr>
          </table>
          ${footnote ? `<p style="margin:28px 0 0;font-size:12px;line-height:1.55;color:#8a8f9d;">${footnote}</p>` : ""}
          <hr style="border:0;border-top:1px solid #e7e9ec;margin:32px 0 20px;">
          <p style="margin:0;font-size:11px;line-height:1.6;color:#8a8f9d;">
            You're receiving this because you have email notifications enabled.
            <a href="${vars.manage_prefs_url}" style="color:#52576a;text-decoration:underline;">Manage preferences</a>
            ·
            <a href="${vars.unsubscribe_url}" style="color:#52576a;text-decoration:underline;">Unsubscribe</a>
          </p>
        </td></tr>
      </table>
      <p style="margin:20px 0 0;font-size:11px;color:#8a8f9d;font-family:${FONT_STACK};">Design Tracker · <a href="${escape(vars.task_url.split("/").slice(0, 3).join("/"))}" style="color:#8a8f9d;text-decoration:underline;">onusano.com/design-tracker</a></p>
    </td></tr>
  </table>
</body>
</html>`;
}

function detailQuote(text: string): string {
  if (!text) return "";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;"><tr><td style="border-left:3px solid #d6d9de;padding:8px 14px;background:#fbfbfa;border-radius:0 6px 6px 0;"><p style="margin:0;font-size:14px;line-height:1.55;color:#52576a;">${escape(text)}</p></td></tr></table>`;
}

function taskAssigned(vars: TemplateVars): RenderedEmail {
  const subject = `${vars.actor_name} assigned you "${vars.task_title}"`;
  const intro = `<strong style="color:#0a0d12;">${escape(vars.actor_name)}</strong> assigned a task to you.`;
  const detailBlock = detailQuote(vars.task_title);
  const html = shell({
    preheader: subject,
    heading: "New task assigned to you",
    intro,
    detailBlock,
    ctaLabel: "Open task",
    ctaUrl: vars.task_url,
    vars,
  });
  const text = [
    "New task assigned to you",
    "",
    `${vars.actor_name} assigned a task to you:`,
    `"${vars.task_title}"`,
    "",
    `Open task: ${vars.task_url}`,
    "",
    `Manage preferences: ${vars.manage_prefs_url}`,
    `Unsubscribe: ${vars.unsubscribe_url}`,
  ].join("\n");
  return { subject, html, text };
}

function commentMention(vars: TemplateVars): RenderedEmail {
  const subject = `${vars.actor_name} mentioned you in "${vars.task_title}"`;
  const intro = `<strong style="color:#0a0d12;">${escape(vars.actor_name)}</strong> mentioned you in a comment on <strong style="color:#0a0d12;">${escape(vars.task_title)}</strong>.`;
  const detailBlock = vars.comment_preview ? detailQuote(vars.comment_preview) : "";
  const html = shell({
    preheader: subject,
    heading: "You were mentioned",
    intro,
    detailBlock,
    ctaLabel: "View comment",
    ctaUrl: vars.task_url,
    vars,
  });
  const text = [
    "You were mentioned",
    "",
    `${vars.actor_name} mentioned you in "${vars.task_title}":`,
    vars.comment_preview ? `"${vars.comment_preview}"` : "",
    "",
    `View comment: ${vars.task_url}`,
    "",
    `Manage preferences: ${vars.manage_prefs_url}`,
    `Unsubscribe: ${vars.unsubscribe_url}`,
  ].filter(Boolean).join("\n");
  return { subject, html, text };
}

function commentReply(vars: TemplateVars): RenderedEmail {
  const subject = `${vars.actor_name} replied on "${vars.task_title}"`;
  const intro = `<strong style="color:#0a0d12;">${escape(vars.actor_name)}</strong> replied on <strong style="color:#0a0d12;">${escape(vars.task_title)}</strong>.`;
  const detailBlock = vars.comment_preview ? detailQuote(vars.comment_preview) : "";
  const html = shell({
    preheader: subject,
    heading: "New activity on a task you follow",
    intro,
    detailBlock,
    ctaLabel: "Open thread",
    ctaUrl: vars.task_url,
    vars,
  });
  const text = [
    "New activity on a task you follow",
    "",
    `${vars.actor_name} replied on "${vars.task_title}":`,
    vars.comment_preview ? `"${vars.comment_preview}"` : "",
    "",
    `Open thread: ${vars.task_url}`,
    "",
    `Manage preferences: ${vars.manage_prefs_url}`,
    `Unsubscribe: ${vars.unsubscribe_url}`,
  ].filter(Boolean).join("\n");
  return { subject, html, text };
}

function workspaceInvite(vars: TemplateVars): RenderedEmail {
  const wsName = vars.workspace_name ?? "a workspace";
  const subject = `${vars.actor_name} invited you to ${wsName}`;
  const intro = `<strong style="color:#0a0d12;">${escape(vars.actor_name)}</strong> invited you to collaborate in <strong style="color:#0a0d12;">${escape(wsName)}</strong> on Design Tracker.`;
  const html = shell({
    preheader: subject,
    heading: `You've been invited to ${wsName}`,
    intro,
    ctaLabel: "Accept invite",
    ctaUrl: vars.invite_url ?? vars.task_url,
    footnote:
      "This link is valid for 7 days. If you don't have an account yet, you'll be guided through a quick sign-up first.",
    vars,
  });
  const text = [
    `You've been invited to ${wsName}`,
    "",
    `${vars.actor_name} invited you to collaborate in ${wsName} on Design Tracker.`,
    "",
    `Accept invite: ${vars.invite_url ?? vars.task_url}`,
    "",
    "This link is valid for 7 days.",
    "",
    `Unsubscribe from invite emails: ${vars.unsubscribe_url}`,
  ].join("\n");
  return { subject, html, text };
}

export function renderTemplate(
  template: EmailTemplate,
  vars: TemplateVars,
): RenderedEmail {
  switch (template) {
    case "task_assigned": return taskAssigned(vars);
    case "comment_mention": return commentMention(vars);
    case "comment_reply": return commentReply(vars);
    case "workspace_invite": return workspaceInvite(vars);
  }
}

export { htmlToText };
