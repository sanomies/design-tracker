import { useEffect } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Loader2, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/AuthProvider";
import { AuthShell } from "@/features/auth/LoginPage";
import { useCurrentWorkspaceId } from "@/features/workspaces/CurrentWorkspaceProvider";
import {
  useAcceptInvitation,
  useInvitationByToken,
} from "@/features/invites/useInvitations";

export default function AcceptInvitePage() {
  const { token } = useParams<{ token: string }>();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { setCurrentWorkspaceId } = useCurrentWorkspaceId();
  const { data: invitation, isLoading, error } = useInvitationByToken(token);
  const accept = useAcceptInvitation();

  // Auto-accept the moment the page loads with an authed user and a valid
  // invitation. Saves the user a redundant click.
  useEffect(() => {
    if (!token) return;
    if (loading) return;
    if (!user) return;
    if (!invitation) return;
    if (invitation.accepted_at) return;
    if (parseISO(invitation.expires_at).getTime() < Date.now()) return;
    if (accept.isPending || accept.isSuccess) return;

    accept.mutate(token, {
      onSuccess: (workspaceId) => {
        setCurrentWorkspaceId(workspaceId);
        toast.success(`Joined ${invitation.workspace_name}`);
        navigate("/", { replace: true });
      },
      onError: (err) => {
        toast.error(err instanceof Error ? err.message : "Failed to accept invite");
      },
    });
  }, [token, loading, user, invitation, accept, navigate, setCurrentWorkspaceId]);

  if (!token) return <Navigate to="/" replace />;

  if (loading || isLoading) {
    return (
      <AuthShell title="Checking your invitation…">
        <div className="flex items-center justify-center p-6">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </AuthShell>
    );
  }

  if (error || !invitation) {
    return (
      <AuthShell title="Invitation not found">
        <Card>
          <p className="text-sm">
            This invite link is invalid or has been revoked.
          </p>
          <BackToSignIn />
        </Card>
      </AuthShell>
    );
  }

  if (invitation.accepted_at) {
    return (
      <AuthShell title="Already used">
        <Card>
          <p className="text-sm">
            This invitation has already been accepted. Ask whoever sent it to generate a new one if you still need access.
          </p>
          <BackToSignIn />
        </Card>
      </AuthShell>
    );
  }

  if (parseISO(invitation.expires_at).getTime() < Date.now()) {
    return (
      <AuthShell title="Invitation expired">
        <Card>
          <p className="text-sm">
            This link is no longer valid. Ask for a fresh one.
          </p>
          <BackToSignIn />
        </Card>
      </AuthShell>
    );
  }

  // Unauthenticated user with a valid invite: send them to sign in / sign up.
  // We stash the token in the redirect target so they land back here after.
  if (!user) {
    // `LoginPage` already redirects to `location.state.from.pathname` after
    // sign-in, so handing it that path round-trips us back here.
    const fromState = { from: { pathname: `/invite/${token}` } };
    return (
      <AuthShell title="You've been invited">
        <Card>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Users className="h-5 w-5 text-primary" aria-hidden />
            </div>
            <div className="min-w-0">
              <p className="text-sm">
                Join <strong>{invitation.workspace_name}</strong>
              </p>
              {invitation.invited_email && (
                <p className="text-xs text-muted-foreground truncate">
                  Invite was addressed to {invitation.invited_email}
                </p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-4">
            <Button asChild variant="outline">
              <Link to="/login" state={fromState}>Sign in</Link>
            </Button>
            <Button asChild>
              <Link to="/signup" state={fromState}>Sign up</Link>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Signing up? Click the confirmation email, then re-open this invite link to finish joining.
          </p>
        </Card>
      </AuthShell>
    );
  }

  // Authenticated + invitation valid: useEffect above auto-accepts. Show a
  // spinner state in the meantime.
  return (
    <AuthShell title={`Joining ${invitation.workspace_name}…`}>
      <div className="flex items-center justify-center p-6">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    </AuthShell>
  );
}

// --- helpers ----------------------------------------------------------

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border bg-card p-5 space-y-3">{children}</div>;
}

function BackToSignIn() {
  return (
    <Link to="/login" className="text-sm text-foreground underline underline-offset-4">
      Back to sign in
    </Link>
  );
}

// Inlined so we don't drag in date-fns for one call.
function parseISO(s: string): Date {
  return new Date(s);
}
