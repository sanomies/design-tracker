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
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const { setCurrentWorkspaceId } = useCurrentWorkspaceId();
  const { data: invitation, isLoading, error } = useInvitationByToken(token);
  const accept = useAcceptInvitation();

  // Email-bound invites can only be accepted by the addressed account. The
  // server enforces this in accept_invitation(); we mirror the check here so a
  // signed-in-as-the-wrong-account user gets a clear message instead of a
  // failing RPC (which would otherwise re-fire the auto-accept effect).
  const invitedEmail = invitation?.invited_email?.trim().toLowerCase() || null;
  const currentEmail = user?.email?.trim().toLowerCase() || null;
  const emailMismatch = !!user && !!invitedEmail && invitedEmail !== currentEmail;

  // Auto-accept the moment the page loads with an authed user and a valid
  // invitation. Saves the user a redundant click.
  useEffect(() => {
    if (!token) return;
    if (loading) return;
    if (!user) return;
    if (!invitation) return;
    if (invitation.accepted_at) return;
    if (parseISO(invitation.expires_at).getTime() < Date.now()) return;
    if (emailMismatch) return;
    if (accept.isPending || accept.isSuccess || accept.isError) return;

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
  }, [token, loading, user, invitation, emailMismatch, accept, navigate, setCurrentWorkspaceId]);

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

  // Email-bound invite opened by the wrong account: don't auto-accept, explain
  // how to fix it.
  if (emailMismatch) {
    return (
      <AuthShell title="Wrong account">
        <Card>
          <p className="text-sm">
            This invitation was sent to{" "}
            <strong>{invitation.invited_email}</strong>, but you're signed in as{" "}
            <strong>{user.email}</strong>.
          </p>
          <p className="text-sm text-muted-foreground">
            Sign out and sign back in with {invitation.invited_email} to accept it.
          </p>
          <Button variant="outline" onClick={() => void signOut()}>
            Sign out
          </Button>
        </Card>
      </AuthShell>
    );
  }

  // Acceptance failed (e.g. revoked between load and accept). Surface it
  // instead of spinning forever.
  if (accept.isError) {
    return (
      <AuthShell title="Couldn't join">
        <Card>
          <p className="text-sm">
            {accept.error instanceof Error
              ? accept.error.message
              : "We couldn't accept this invitation. Ask for a fresh link."}
          </p>
          <BackToSignIn />
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
