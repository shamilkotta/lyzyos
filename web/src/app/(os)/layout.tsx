import { OsShell } from "@/components/os/OsShell";
import { requireSession } from "@/server/session";

export const dynamic = "force-dynamic";

export default async function OsLayout({ children }: { children: React.ReactNode }) {
  await requireSession();
  return <OsShell>{children}</OsShell>;
}
