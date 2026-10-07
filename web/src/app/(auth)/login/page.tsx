import { Suspense } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <AuthShell title="Welcome back" subtitle="Sign in with your email and password.">
      <Suspense fallback={<p className="text-center text-[13px] text-ink-secondary">Loading…</p>}>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
