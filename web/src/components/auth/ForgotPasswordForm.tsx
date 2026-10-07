"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { AuthField } from "@/components/auth/AuthField";
import { AuthFormError } from "@/components/auth/AuthFormError";
import { requestPasswordReset } from "@/lib/auth-client";
import { routes } from "@/lib/routes";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);

    const redirectTo = `${window.location.origin}${routes.resetPassword}`;
    const { error: resetError } = await requestPasswordReset({
      email: email.trim(),
      redirectTo,
    });

    setPending(false);

    if (resetError) {
      setError(resetError.message || "Could not send reset email.");
      return;
    }

    setSent(true);
  }

  if (sent) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-[13px] text-ink-secondary">
          If an account exists for <span className="text-ink">{email.trim()}</span>, a reset link
          was sent. Check your server logs in local development.
        </p>
        <Link href={routes.login} className="text-[12px] font-medium text-ink hover:underline">
          Back to sign in
        </Link>
      </div>
    );
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
      <Button type="submit" className="w-full py-2" disabled={pending}>
        {pending ? "Sending…" : "Send reset link"}
      </Button>
      <p className="text-center text-[12px] text-ink-secondary">
        <Link href={routes.login} className="font-medium text-ink hover:underline">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
