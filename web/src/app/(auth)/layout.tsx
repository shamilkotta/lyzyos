import { redirect } from "next/navigation";
import { routes } from "@/lib/routes";
import { getSession } from "@/server/session";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  if (await getSession()) redirect(routes.home);
  return <div className="h-full overflow-auto">{children}</div>;
}
