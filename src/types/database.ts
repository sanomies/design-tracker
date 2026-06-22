// Hand-written DB types matching supabase/migrations/0001_init.sql.
// Shape mirrors `supabase gen types typescript` so we can swap to generated
// types later without rewriting consumers.

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export type TaskStatus = "todo" | "in_progress" | "done";
export type TaskPriority = "low" | "medium" | "high";
export type WorkspaceRole = "owner" | "member";

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          avatar_url: string | null;
          email_status: "ok" | "bounced" | "complained";
          created_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          avatar_url?: string | null;
          email_status?: "ok" | "bounced" | "complained";
          created_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string | null;
          avatar_url?: string | null;
          email_status?: "ok" | "bounced" | "complained";
          created_at?: string;
        };
        Relationships: [];
      };
      workspaces: {
        Row: {
          id: string;
          name: string;
          owner_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          owner_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          owner_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      workspace_members: {
        Row: {
          workspace_id: string;
          user_id: string;
          role: WorkspaceRole;
          created_at: string;
        };
        Insert: {
          workspace_id: string;
          user_id: string;
          role: WorkspaceRole;
          created_at?: string;
        };
        Update: {
          workspace_id?: string;
          user_id?: string;
          role?: WorkspaceRole;
          created_at?: string;
        };
        Relationships: [];
      };
      projects: {
        Row: {
          id: string;
          workspace_id: string;
          name: string;
          color: string;
          position: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          name: string;
          color?: string;
          position?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          name?: string;
          color?: string;
          position?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      project_members: {
        Row: {
          project_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          project_id: string;
          user_id: string;
          created_at?: string;
        };
        Update: {
          project_id?: string;
          user_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      project_seen: {
        Row: {
          project_id: string;
          user_id: string;
          last_seen_at: string;
        };
        Insert: {
          project_id: string;
          user_id: string;
          last_seen_at?: string;
        };
        Update: {
          project_id?: string;
          user_id?: string;
          last_seen_at?: string;
        };
        Relationships: [];
      };
      sections: {
        Row: {
          id: string;
          project_id: string;
          name: string;
          position: number;
          created_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          project_id: string;
          name: string;
          position?: number;
          created_at?: string;
          created_by?: string | null;
        };
        Update: {
          id?: string;
          project_id?: string;
          name?: string;
          position?: number;
          created_at?: string;
          created_by?: string | null;
        };
        Relationships: [];
      };
      my_task_sections: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          position: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          position?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          position?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      tasks: {
        Row: {
          id: string;
          project_id: string;
          section_id: string | null;
          parent_task_id: string | null;
          title: string;
          description: string | null;
          assignee_id: string | null;
          due_date: string | null;
          status: TaskStatus;
          priority: TaskPriority | null;
          position: number;
          created_at: string;
          created_by: string | null;
          completed_at: string | null;
          my_section_id: string | null;
          my_position: number | null;
          publication: string | null;
          type: string | null;
        };
        Insert: {
          id?: string;
          project_id: string;
          section_id?: string | null;
          parent_task_id?: string | null;
          title: string;
          description?: string | null;
          assignee_id?: string | null;
          due_date?: string | null;
          status?: TaskStatus;
          priority?: TaskPriority | null;
          position?: number;
          created_at?: string;
          created_by?: string | null;
          completed_at?: string | null;
          my_section_id?: string | null;
          my_position?: number | null;
          publication?: string | null;
          type?: string | null;
        };
        Update: {
          id?: string;
          project_id?: string;
          section_id?: string | null;
          parent_task_id?: string | null;
          title?: string;
          description?: string | null;
          assignee_id?: string | null;
          due_date?: string | null;
          status?: TaskStatus;
          priority?: TaskPriority | null;
          position?: number;
          created_at?: string;
          created_by?: string | null;
          completed_at?: string | null;
          my_section_id?: string | null;
          my_position?: number | null;
          publication?: string | null;
          type?: string | null;
        };
        // Only the FK actually used by embedded selects in the app
        // (`select("*, project:projects(...)")`) needs to be declared here.
        Relationships: [
          {
            foreignKeyName: "tasks_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      comments: {
        Row: {
          id: string;
          task_id: string;
          author_id: string | null;
          body: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          task_id: string;
          author_id?: string | null;
          body: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          task_id?: string;
          author_id?: string | null;
          body?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          recipient_id: string;
          actor_id: string | null;
          type:
            | "mention"
            | "comment"
            | "assigned"
            | "unassigned"
            | "completed"
            | "deleted"
            | "invite_accepted";
          task_id: string | null;
          comment_id: string | null;
          data: Json | null;
          read_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          recipient_id: string;
          actor_id?: string | null;
          type:
            | "mention"
            | "comment"
            | "assigned"
            | "unassigned"
            | "completed"
            | "deleted"
            | "invite_accepted";
          task_id?: string | null;
          comment_id?: string | null;
          data?: Json | null;
          read_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          recipient_id?: string;
          actor_id?: string | null;
          type?:
            | "mention"
            | "comment"
            | "assigned"
            | "unassigned"
            | "completed"
            | "deleted"
            | "invite_accepted";
          task_id?: string | null;
          comment_id?: string | null;
          data?: Json | null;
          read_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      workspace_invitations: {
        Row: {
          id: string;
          workspace_id: string;
          invited_email: string | null;
          token: string;
          role: WorkspaceRole;
          created_by: string | null;
          created_at: string;
          expires_at: string;
          accepted_at: string | null;
          accepted_by: string | null;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          invited_email?: string | null;
          token: string;
          role?: WorkspaceRole;
          created_by?: string | null;
          created_at?: string;
          expires_at?: string;
          accepted_at?: string | null;
          accepted_by?: string | null;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          invited_email?: string | null;
          token?: string;
          role?: WorkspaceRole;
          created_by?: string | null;
          created_at?: string;
          expires_at?: string;
          accepted_at?: string | null;
          accepted_by?: string | null;
        };
        Relationships: [];
      };
      comment_reactions: {
        Row: {
          id: string;
          comment_id: string;
          user_id: string;
          emoji: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          comment_id: string;
          user_id: string;
          emoji: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          comment_id?: string;
          user_id?: string;
          emoji?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      attachments: {
        Row: {
          id: string;
          task_id: string;
          uploader_id: string | null;
          file_name: string;
          file_size: number;
          mime_type: string | null;
          storage_path: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          task_id: string;
          uploader_id?: string | null;
          file_name: string;
          file_size: number;
          mime_type?: string | null;
          storage_path: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          task_id?: string;
          uploader_id?: string | null;
          file_name?: string;
          file_size?: number;
          mime_type?: string | null;
          storage_path?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      email_preferences: {
        Row: {
          user_id: string;
          notify_assigned: boolean;
          notify_mention: boolean;
          notify_comment: boolean;
          notify_invite: boolean;
          unsubscribe_token: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          notify_assigned?: boolean;
          notify_mention?: boolean;
          notify_comment?: boolean;
          notify_invite?: boolean;
          unsubscribe_token?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          notify_assigned?: boolean;
          notify_mention?: boolean;
          notify_comment?: boolean;
          notify_invite?: boolean;
          unsubscribe_token?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      email_log: {
        Row: {
          id: string;
          recipient_id: string | null;
          template: string;
          status: "queued" | "sent" | "failed" | "skipped" | "bounced" | "complained";
          resend_message_id: string | null;
          notification_id: string | null;
          invitation_id: string | null;
          payload: Json | null;
          error_message: string | null;
          retry_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          recipient_id?: string | null;
          template: string;
          status: "queued" | "sent" | "failed" | "skipped" | "bounced" | "complained";
          resend_message_id?: string | null;
          notification_id?: string | null;
          invitation_id?: string | null;
          payload?: Json | null;
          error_message?: string | null;
          retry_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          recipient_id?: string | null;
          template?: string;
          status?: "queued" | "sent" | "failed" | "skipped" | "bounced" | "complained";
          resend_message_id?: string | null;
          notification_id?: string | null;
          invitation_id?: string | null;
          payload?: Json | null;
          error_message?: string | null;
          retry_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      is_workspace_member: {
        Args: { _workspace_id: string };
        Returns: boolean;
      };
      is_project_member: {
        Args: { _project_id: string };
        Returns: boolean;
      };
      task_project_id: {
        Args: { _task_id: string };
        Returns: string;
      };
      mark_project_seen: {
        Args: { _project_id: string };
        Returns: undefined;
      };
      unseen_project_ids: {
        Args: Record<string, never>;
        Returns: string[];
      };
      invitation_by_token: {
        Args: { _token: string };
        Returns: Array<{
          id: string;
          workspace_id: string;
          workspace_name: string;
          invited_email: string | null;
          role: WorkspaceRole;
          created_at: string;
          expires_at: string;
          accepted_at: string | null;
        }>;
      };
      accept_invitation: {
        Args: { _token: string };
        Returns: string;
      };
      unsubscribe_email: {
        Args: { _token: string; _kind?: "all" | "assigned" | "mention" | "comment" | "invite" };
        Returns: boolean;
      };
    };
    Enums: Record<string, never>;
  };
};

// Convenience aliases
type T = Database["public"]["Tables"];
export type Profile = T["profiles"]["Row"];
export type Workspace = T["workspaces"]["Row"];
export type WorkspaceMember = T["workspace_members"]["Row"];
export type Project = T["projects"]["Row"];
export type ProjectMember = T["project_members"]["Row"];
export type ProjectSeen = T["project_seen"]["Row"];
export type Section = T["sections"]["Row"];
export type MyTaskSection = T["my_task_sections"]["Row"];
export type Task = T["tasks"]["Row"];
export type TaskInsert = T["tasks"]["Insert"];
export type TaskUpdate = T["tasks"]["Update"];
export type Comment = T["comments"]["Row"];
export type CommentReaction = T["comment_reactions"]["Row"];
export type Attachment = T["attachments"]["Row"];
export type WorkspaceInvitation = T["workspace_invitations"]["Row"];
export type Notification = T["notifications"]["Row"];
export type NotificationType = Notification["type"];
export type EmailPreferences = T["email_preferences"]["Row"];
export type EmailPreferencesUpdate = T["email_preferences"]["Update"];
export type EmailLog = T["email_log"]["Row"];
