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
          created_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
        };
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
      };
      projects: {
        Row: {
          id: string;
          workspace_id: string;
          name: string;
          color: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          name: string;
          color?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          name?: string;
          color?: string;
          created_at?: string;
        };
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
      };
      tasks: {
        Row: {
          id: string;
          project_id: string;
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
        };
        Insert: {
          id?: string;
          project_id: string;
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
        };
        Update: {
          id?: string;
          project_id?: string;
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
        };
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
      };
    };
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
export type Task = T["tasks"]["Row"];
export type TaskInsert = T["tasks"]["Insert"];
export type TaskUpdate = T["tasks"]["Update"];
export type Comment = T["comments"]["Row"];
export type Attachment = T["attachments"]["Row"];
