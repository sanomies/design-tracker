import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";

import osanoLogo from "@/assets/brand/osano-logo.svg";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";

import { useAuth } from "./AuthProvider";
import { signInSchema, type SignInValues } from "./schemas";

type LocationState = { from?: { pathname: string } } | null;

export default function LoginPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as LocationState)?.from?.pathname ?? "/";

  const form = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "" },
  });

  if (!loading && user) {
    return <Navigate to={from} replace />;
  }

  const onSubmit = async (values: SignInValues) => {
    const { error } = await supabase.auth.signInWithPassword(values);
    if (error) {
      toast.error(error.message);
      return;
    }
    navigate(from, { replace: true });
  };

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to continue">
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <Field id="email" label="E-mail" error={form.formState.errors.email?.message}>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            autoFocus
            className={AUTH_INPUT_CLASS}
            {...form.register("email")}
          />
        </Field>
        <Field id="password" label="Password" error={form.formState.errors.password?.message}>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            className={AUTH_INPUT_CLASS}
            {...form.register("password")}
          />
        </Field>
        <Button
          type="submit"
          className={AUTH_SUBMIT_CLASS}
          disabled={form.formState.isSubmitting}
        >
          {form.formState.isSubmitting ? "Signing in…" : "Sign in"}
        </Button>
      </form>
      <p className="text-sm text-center mt-5">
        <span className="font-medium text-[#708597]">No account?</span>{" "}
        <Link
          to="/signup"
          className="font-semibold text-black underline underline-offset-2"
        >
          Sign up
        </Link>
      </p>
    </AuthShell>
  );
}

// Shared field styling so both auth screens match the Figma spec 1:1
// (full-width, h-12, rounded-lg, #DEDFE0 border, comfortable padding).
export const AUTH_INPUT_CLASS =
  "h-12 rounded-lg border-[#DEDFE0] bg-white px-4 text-base md:text-base";
export const AUTH_SUBMIT_CLASS =
  "w-full h-12 rounded-lg bg-foreground text-white font-semibold hover:bg-foreground/90";

// Shared shell + field — kept local to auth pages; promote to /components if reused elsewhere.
export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh flex items-center justify-center px-6 py-9">
      <div className="w-full max-w-sm flex flex-col gap-9">
        {/* Block (not flex) + text-center so a long title like "Create your
            account" wraps inside the card instead of growing to its
            max-content width and overflowing the viewport. */}
        <div className="w-full text-center">
          <img
            src={osanoLogo}
            alt="oSano"
            className="h-[34px] w-auto mx-auto mb-4 shrink-0"
          />
          <h1 className="text-[32px] leading-tight font-bold tracking-tight text-black break-words">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-2 text-sm font-medium text-[#708597]">{subtitle}</p>
          )}
        </div>
        <div className="w-full">{children}</div>
      </div>
    </div>
  );
}

export function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-sm font-semibold text-black">
        {label}
      </Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
