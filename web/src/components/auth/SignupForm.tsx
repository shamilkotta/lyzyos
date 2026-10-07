"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { AuthField } from "@/components/auth/AuthField";
import { AuthFormError } from "@/components/auth/AuthFormError";
import { signUp } from "@/lib/auth-client";
import { routes } from "@/lib/routes";

export function SignupForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);

    const { error: signUpError } = await signUp.email({
      name: name.trim(),
      email: email.trim(),
      password,
      callbackURL: routes.projects,
    });

    setPending(false);

    if (signUpError) {
      setError(signUpError.message || "Could not create account.");
      return;
    }

    router.push(routes.projects);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <AuthFormError message={error} />
      <AuthField
        label="Name"
        id="name"
        name="name"
        type="text"
        autoComplete="name"
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Ada Lovelace"
      />
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
        autoComplete="new-password"
        required
        minLength={8}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="At least 8 characters"
      />
      <Button type="submit" className="w-full py-2" disabled={pending}>
        {pending ? "Creating account…" : "Create account"}
      </Button>
      <p className="text-center text-[12px] text-ink-secondary">
        Already have an account?{" "}
        <Link href={routes.login} className="font-medium text-ink hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
