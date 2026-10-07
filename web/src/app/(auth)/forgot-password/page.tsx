import { AuthShell } from "@/components/auth/AuthShell";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Reset password"
      subtitle="We'll send a reset link if that email is registered."
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
