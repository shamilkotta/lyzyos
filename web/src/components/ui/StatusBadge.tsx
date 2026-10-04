import clsx from "clsx";
import type { StatusTone } from "@/lib/types";

const toneMap: Record<StatusTone, string> = {
  neutral: "bg-surface-soft text-ink-secondary",
  ok: "bg-pale-green text-pale-green-ink",
  warn: "bg-pale-yellow text-pale-yellow-ink",
  danger: "bg-pale-red text-pale-red-ink",
  info: "bg-pale-blue text-pale-blue-ink",
};

export function StatusBadge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: StatusTone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.05em]",
        toneMap[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
