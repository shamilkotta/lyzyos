"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { AuthField } from "@/components/auth/AuthField";
import { AuthFormError } from "@/components/auth/AuthFormError";
import { signIn } from "@/lib/auth-client";
import { routes } from "@/lib/routes";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || routes.projects;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);

    const { error: signInError } = await signIn.email({
      email: email.trim(),
      password,
      callbackURL: next,
    });

    setPending(false);

    if (signInError) {
      setError(signInError.message || "Could not sign in.");
      return;
    }

    router.push(next);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <AuthFormError message={error} />
      <AuthField
        label="Email"
        id="email"
        name="email"
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@company.com"
      />
      <AuthField
        label="Password"
        id="password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        minLength={8}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="••••••••"
      />
      <div className="flex justify-end">
        <Link
          href={routes.forgotPassword}
          className="text-[12px] text-ink-secondary transition-colors hover:text-ink"
        >
          Forgot password?
        </Link>
      </div>
      <Button type="submit" className="w-full py-2" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
