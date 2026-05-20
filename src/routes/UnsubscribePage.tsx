import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Check, X } from "lucide-react";

import { supabase } from "@/lib/supabase";

type Kind = "all" | "assigned" | "mention" | "comment" | "invite";

const KIND_LABELS: Record<Kind, string> = {
  all: "all email notifications",
  assigned: "task-assignment emails",
  mention: "mention emails",
  comment: "comment-thread emails",
  invite: "workspace-invite emails",
};

export default function UnsubscribePage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const rawKind = (params.get("kind") ?? "all") as Kind;
  const kind: Kind = ["all", "assigned", "mention", "comment", "invite"].includes(rawKind)
    ? rawKind
    : "all";

  const [state, setState] = useState<"working" | "done" | "fail">("working");

  useEffect(() => {
    if (!token) {
      setState("fail");
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.rpc("unsubscribe_email", {
        _token: token,
        _kind: kind,
      });
      if (cancelled) return;
      setState(error || data !== true ? "fail" : "done");
    })();
    return () => {
      cancelled = true;
    };
  }, [token, kind]);

  return (
    <div className="min-h-dvh flex items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        {state === "working" && (
          <p className="text-sm text-muted-foreground">Updating your preferences…</p>
        )}

        {state === "done" && (
          <>
            <div className="mx-auto mb-4 grid h-10 w-10 place-items-center rounded-full bg-foreground/5">
              <Check className="h-5 w-5" />
            </div>
            <h1 className="text-xl font-semibold tracking-tight">Unsubscribed</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              You won't receive {KIND_LABELS[kind]} from Design Tracker anymore.
            </p>
            <p className="mt-6 text-xs text-muted-foreground">
              Changed your mind? You can re-enable any of these on the{" "}
              <a href="/settings/email" className="underline">
                email preferences page
              </a>
              .
            </p>
          </>
        )}

        {state === "fail" && (
          <>
            <div className="mx-auto mb-4 grid h-10 w-10 place-items-center rounded-full bg-destructive/10 text-destructive">
              <X className="h-5 w-5" />
            </div>
            <h1 className="text-xl font-semibold tracking-tight">
              We couldn't unsubscribe you
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              The link may have expired or been mistyped. Sign in and adjust your
              preferences on the{" "}
              <a href="/settings/email" className="underline">
                email preferences page
              </a>
              .
            </p>
          </>
        )}
      </div>
    </div>
  );
}
