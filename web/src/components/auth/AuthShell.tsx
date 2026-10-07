import Link from "next/link";
import { PRODUCT_NAME } from "@/lib/data";
import { routes } from "@/lib/routes";

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="os-grain relative flex min-h-full items-center justify-center px-4 py-10">
      <div className="ambient-blob left-[-10%] top-[-20%]" />
      <div
        className="ambient-blob right-[-15%] bottom-[-25%]"
        style={{ animationDelay: "-12s", opacity: 0.7 }}
      />

      <div className="relative z-10 w-full max-w-[400px]">
        <Link href={routes.login} className="mb-8 flex items-center justify-center gap-2 text-ink">
          <span className="flex h-8 w-8 items-center justify-center rounded-[6px] bg-ink text-[12px] font-medium text-white">
            Ly
          </span>
          <span className="font-brand text-[26px] font-semibold leading-none tracking-[-0.04em]">
            {PRODUCT_NAME}
          </span>
        </Link>

        <div className="rounded-[10px] border border-border bg-surface/90 p-6 shadow-[var(--shadow-soft)] backdrop-blur-sm">
          <div className="mb-6 text-center">
            <h1 className="text-[18px] font-medium tracking-[-0.02em] text-ink">{title}</h1>
            <p className="mt-1.5 text-[13px] text-ink-secondary">{subtitle}</p>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
