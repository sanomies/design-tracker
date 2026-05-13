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
import { AuthShell, Field } from "./LoginPage";
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
            {...form.register("fullName")}
          />
        </Field>
        <Field id="email" label="Email" error={form.formState.errors.email?.message}>
          <Input id="email" type="email" autoComplete="email" {...form.register("email")} />
        </Field>
        <Field id="password" label="Password" error={form.formState.errors.password?.message}>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            {...form.register("password")}
          />
        </Field>
        <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Creating account…" : "Sign up"}
        </Button>
      </form>
      <p className="text-sm text-muted-foreground text-center mt-6">
        Already have an account?{" "}
        <Link to="/login" className="text-foreground underline underline-offset-4">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
