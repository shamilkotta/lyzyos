"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { AuthField } from "@/components/auth/AuthField";
import { AuthFormError } from "@/components/auth/AuthFormError";
import { resetPassword } from "@/lib/auth-client";
import { routes } from "@/lib/routes";

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (!token) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-[13px] text-ink-secondary">
          This reset link is missing or invalid. Request a new one.
        </p>
        <Link
          href={routes.forgotPassword}
          className="text-[12px] font-medium text-ink hover:underline"
        >
          Request reset link
        </Link>
      </div>
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setPending(true);
    const { error: resetError } = await resetPassword({
      newPassword: password,
      token,
    });
    setPending(false);

    if (resetError) {
      setError(resetError.message || "Could not reset password.");
      return;
    }

    router.push(routes.login);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <AuthFormError message={error} />
      <AuthField
        label="New password"
        id="password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={8}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="At least 8 characters"
      />
      <AuthField
        label="Confirm password"
        id="confirm"
        name="confirm"
        type="password"
        autoComplete="new-password"
        required
        minLength={8}
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        placeholder="Repeat password"
      />
      <Button type="submit" className="w-full py-2" disabled={pending}>
        {pending ? "Updating…" : "Update password"}
      </Button>
    </form>
  );
}
