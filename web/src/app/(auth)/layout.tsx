import { RedirectIfSignedIn } from "@/components/auth/RedirectIfSignedIn";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-full overflow-auto">
      <RedirectIfSignedIn />
      {children}
    </div>
  );
}
