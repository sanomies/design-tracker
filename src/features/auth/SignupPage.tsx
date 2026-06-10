import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, Navigate } from "react-router-dom";
import { toast } from "sonner";
import { Mail } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";

import { useAuth } from "./AuthProvider";
import { AuthShell, Field, AUTH_INPUT_CLASS, AUTH_SUBMIT_CLASS } from "./LoginPage";
import { signUpSchema, type SignUpValues } from "./schemas";

export default function SignupPage() {
  const { user, loading } = useAuth();
  const [confirmationEmail, setConfirmationEmail] = useState<string | null>(null);

  const form = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { fullName: "", email: "", password: "" },
  });

  if (!loading && user) {
    return <Navigate to="/" replace />;
  }

  if (confirmationEmail) {
    return (
      <AuthShell title="Check your email">
        <div className="rounded-lg border bg-card p-6 text-center space-y-3">
          <Mail className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden />
          <p className="text-sm">
            We sent a confirmation link to <strong>{confirmationEmail}</strong>. Click it to
            activate your account, then come back and sign in.
          </p>
        </div>
        <p className="text-sm text-muted-foreground text-center mt-6">
          <Link to="/login" className="text-foreground underline underline-offset-4">
            Back to sign in
          </Link>
        </p>
      </AuthShell>
    );
  }

  const onSubmit = async (values: SignUpValues) => {
    const { data, error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        data: { full_name: values.fullName },
      },
    });

    if (error) {
      toast.error(error.message);
      return;
    }

    // With email confirmation enabled, signUp returns a user but no session.
    // If session exists (confirmation disabled in Supabase settings), AuthProvider
    // will pick it up and the Navigate above will redirect.
    if (data.session === null) {
      setConfirmationEmail(values.email);
    }
  };

  return (
    <AuthShell title="Create your account" subtitle="Start tracking your work">
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <Field id="fullName" label="Full name" error={form.formState.errors.fullName?.message}>
          <Input
            id="fullName"
            autoComplete="name"
            autoFocus
            className={AUTH_INPUT_CLASS}
            {...form.register("fullName")}
          />
        </Field>
        <Field id="email" label="E-mail" error={form.formState.errors.email?.message}>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            className={AUTH_INPUT_CLASS}
            {...form.register("email")}
          />
        </Field>
        <Field id="password" label="Password" error={form.formState.errors.password?.message}>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            className={AUTH_INPUT_CLASS}
            {...form.register("password")}
          />
        </Field>
        <Button
          type="submit"
          className={AUTH_SUBMIT_CLASS}
          disabled={form.formState.isSubmitting}
        >
          {form.formState.isSubmitting ? "Creating account…" : "Sign up"}
        </Button>
      </form>
      <p className="text-sm text-center mt-5">
        <span className="font-medium text-[#708597]">Already have an account?</span>{" "}
        <Link
          to="/login"
          className="font-semibold text-black underline underline-offset-2"
        >
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
