import { useState } from "react";
import { formatDistanceToNow, parseISO } from "date-fns";
import { toast } from "sonner";
import { Check, Copy, Trash2 } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { avatarColor } from "@/lib/avatarColor";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/features/auth/AuthProvider";
import {
  inviteUrl,
  useCreateInvitation,
  useDeleteInvitation,
  useInvitations,
} from "@/features/invites/useInvitations";
import { useWorkspaceMembers } from "@/features/workspaces/useWorkspaceMembers";
import type { Workspace, WorkspaceInvitation } from "@/types/database";

export function MembersDialog({
  workspace,
  open,
  onOpenChange,
}: {
  workspace: Workspace | null;
  open: boolean;
  onOpenChange: (next: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {workspace ? `${workspace.name} members` : "Members"}
          </DialogTitle>
          <DialogDescription>
            Invite teammates by generating a shareable link and sending it however you like.
          </DialogDescription>
        </DialogHeader>
        {workspace && <Body workspace={workspace} />}
      </DialogContent>
    </Dialog>
  );
}

function Body({ workspace }: { workspace: Workspace }) {
  const { user } = useAuth();
  const { data: members, isLoading: membersLoading } = useWorkspaceMembers(workspace.id);
  const { data: invitations, isLoading: invitesLoading } = useInvitations(workspace.id);
  const create = useCreateInvitation(workspace.id);
  const remove = useDeleteInvitation(workspace.id);

  const [email, setEmail] = useState("");

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const invite = await create.mutateAsync({ email });
      setEmail("");
      const url = inviteUrl(invite.token);
      try {
        await navigator.clipboard.writeText(url);
        toast.success("Invite link copied to clipboard");
      } catch {
        toast.success("Invite created — click Copy on the row to grab the link");
      }
    } catch {
      // toast already fired in mutation
    }
  };

  return (
    <div className="space-y-5">
      <section className="space-y-2">
        <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Members ({members?.length ?? 0})
        </h3>
        {membersLoading ? (
          <div className="space-y-1.5">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <ul className="space-y-1">
            {members?.map((m) => (
              <li
                key={m.id}
                className="flex items-center gap-2 rounded-md p-2 hover:bg-muted/40"
              >
                <Avatar className="h-7 w-7">
                  <AvatarFallback className={cn("text-xs", avatarColor(m.id))}>
                    {initials(m.full_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">
                    {m.full_name ?? "Unnamed"}
                    {m.id === user?.id && (
                      <span className="ml-1 text-xs text-muted-foreground">(you)</span>
                    )}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Invite someone
        </h3>
        <form onSubmit={onCreate} className="flex gap-2">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="teammate@example.com (optional)"
            className="flex-1"
          />
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? "Creating…" : "Create invite link"}
          </Button>
        </form>
        <p className="text-xs text-muted-foreground">
          Add an email to lock the invite to that person — only they can accept it.
          Leave it blank for an open link anyone can use.
        </p>
      </section>

      <section className="space-y-2">
        <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Pending invites ({invitations?.length ?? 0})
        </h3>
        {invitesLoading ? (
          <Skeleton className="h-12 w-full" />
        ) : invitations && invitations.length > 0 ? (
          <ul className="space-y-1">
            {invitations.map((inv) => (
              <PendingInviteRow
                key={inv.id}
                invitation={inv}
                onRevoke={() => remove.mutate(inv.id)}
              />
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">No pending invites.</p>
        )}
      </section>
    </div>
  );
}

function PendingInviteRow({
  invitation,
  onRevoke,
}: {
  invitation: WorkspaceInvitation;
  onRevoke: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const url = inviteUrl(invitation.token);
  const expiresIn = formatDistanceToNow(parseISO(invitation.expires_at), { addSuffix: true });
  const expired = parseISO(invitation.expires_at).getTime() < Date.now();

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Failed to copy link");
    }
  };

  return (
    <li className="flex items-center gap-2 rounded-md border bg-background p-2">
      <div className="flex-1 min-w-0">
        <p className="text-sm truncate">
          {invitation.invited_email ?? <span className="text-muted-foreground">No email</span>}
        </p>
        <p className="text-xs text-muted-foreground">
          {expired ? "Expired" : `Expires ${expiresIn}`}
        </p>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={copy}
        className="h-8 px-2"
        aria-label="Copy invite link"
      >
        {copied ? (
          <>
            <Check className="h-3.5 w-3.5 mr-1" />
            Copied
          </>
        ) : (
          <>
            <Copy className="h-3.5 w-3.5 mr-1" />
            Copy link
          </>
        )}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onRevoke}
        className="h-8 w-8"
        aria-label="Revoke invite"
      >
        <Trash2 className="h-3.5 w-3.5 text-destructive" />
      </Button>
    </li>
  );
}

function initials(name: string | null): string {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
