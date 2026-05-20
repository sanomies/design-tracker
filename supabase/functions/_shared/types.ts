// Shared types between the dispatch trigger payload and the Edge Function.

export type DispatchPayload =
  | { kind: "notification"; notification_id: string }
  | { kind: "invitation"; invitation_id: string };

export type EmailTemplate =
  | "task_assigned"
  | "comment_mention"
  | "comment_reply"
  | "workspace_invite";

export type EmailPreferences = {
  user_id: string;
  notify_assigned: boolean;
  notify_mention: boolean;
  notify_comment: boolean;
  notify_invite: boolean;
  unsubscribe_token: string;
};

export type RenderedEmail = {
  subject: string;
  html: string;
  text: string;
  headers?: Record<string, string>;
  tags?: Array<{ name: string; value: string }>;
};

// Vars passed to each template.
export type TemplateVars = {
  recipient_name: string | null;
  actor_name: string;
  task_title: string;
  task_url: string;
  comment_preview?: string;
  workspace_name?: string;
  invite_url?: string;
  unsubscribe_url: string;
  manage_prefs_url: string;
};
