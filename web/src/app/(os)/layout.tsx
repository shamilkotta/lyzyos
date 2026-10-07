import { OsShell } from "@/components/os/OsShell";
import { requireSession } from "@/server/session";

export default async function OsLayout({ children }: { children: React.ReactNode }) {
  await requireSession();
  return <OsShell>{children}</OsShell>;
}
