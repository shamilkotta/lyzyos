"use client";

import { SpinnerGapIcon } from "@phosphor-icons/react";
import { useCurrentUser } from "@/lib/session";

export function SettingsView() {
  const { user, isPending } = useCurrentUser();

  const rows = user
    ? [
        { label: "Name", value: user.name },
        { label: "Email", value: user.email },
      ]
    : [];

  return (
    <div className="h-full overflow-auto">
      <div className="mx-auto max-w-xl px-8 py-12 fade-up">
        <h1 className="text-[28px] font-medium tracking-[-0.03em] text-ink">Settings</h1>
        <p className="mt-2 text-[14px] text-ink-secondary">Your account. Kept quiet on purpose.</p>

        {isPending ? (
          <div className="mt-8 flex items-center gap-2 text-[13px] text-ink-tertiary">
            <SpinnerGapIcon size={14} className="animate-spin" />
            Loading account…
          </div>
        ) : (
          <dl className="mt-8 rounded-[12px] border border-border bg-surface">
            {rows.map((row) => (
              <div
                key={row.label}
                className="flex items-center justify-between gap-4 border-b border-border px-4 py-3 text-[13px] last:border-0"
              >
                <dt className="text-ink-secondary">{row.label}</dt>
                <dd className="truncate text-ink">{row.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </div>
  );
}
