"use client";

import { useState, type ReactNode } from "react";
import { CaretDown, CaretLeft, CaretUp, Warning } from "@phosphor-icons/react";
import clsx from "clsx";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { workStatusLabel, workStatusTone } from "@/lib/status";
import type { WorkStatus } from "@/lib/types";
import type { SyncConnectionStatus } from "@/lib/useProjectSync";

const SYNC_LABEL: Record<SyncConnectionStatus, string> = {
  connecting: "Connecting…",
  live: "Synced",
  reconnecting: "Reconnecting…",
  offline: "Offline",
};

function SyncIndicator({ status }: { status: SyncConnectionStatus }) {
  return (
    <span
      role="status"
      title={SYNC_LABEL[status]}
      aria-label={SYNC_LABEL[status]}
      className="flex items-center gap-1.5 text-[11px] text-ink-tertiary"
    >
      <span
        className={clsx(
          "h-1.5 w-1.5 rounded-full",
          status === "live"
            ? "bg-pale-green-ink"
            : status === "offline"
              ? "bg-ink-tertiary"
              : "animate-pulse bg-pale-yellow-ink",
        )}
      />
      {status === "live" ? null : SYNC_LABEL[status]}
    </span>
  );
}

function AttentionBanner({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <button
      type="button"
      onClick={() => setExpanded((v) => !v)}
      aria-expanded={expanded}
      className={clsx(
        "pointer-events-auto flex min-w-0 max-w-md gap-1.5 rounded-[8px] bg-pale-yellow px-2.5 text-left text-[12px] leading-snug text-pale-yellow-ink shadow-sm backdrop-blur-md transition-colors hover:brightness-[0.98]",
        expanded ? "items-start py-2" : "h-8 items-center",
      )}
    >
      <Warning size={13} weight="bold" className="shrink-0" />
      <span className={clsx("min-w-0 flex-1", !expanded && "line-clamp-1")}>{text}</span>
      {expanded ? (
        <CaretUp size={12} weight="bold" className="mt-0.5 shrink-0 opacity-70" />
      ) : (
        <CaretDown size={12} weight="bold" className="shrink-0 opacity-70" />
      )}
    </button>
  );
}

type Props = {
  name: string;
  status: WorkStatus;
  attention: string | null;
  syncStatus: SyncConnectionStatus;
  onBack: () => void;
  /** Presence stack + add-member control. */
  presence: ReactNode;
};

export function WorkspaceHeader({ name, status, attention, syncStatus, onBack, presence }: Props) {
  return (
    <div className="fade-up pointer-events-none absolute left-4 top-4 z-10 flex max-w-[calc(100%-2rem)] flex-wrap items-start gap-2">
      <Button variant="secondary" className="pointer-events-auto h-8 shrink-0" onClick={onBack}>
        <CaretLeft size={14} weight="bold" />
        Campaign graph
      </Button>

      <div className="pointer-events-auto flex h-8 shrink-0 items-center gap-2 rounded-[8px] border border-border bg-surface/95 px-3 backdrop-blur-md">
        <span className="text-[13px] font-medium text-ink">{name}</span>
        <StatusBadge tone={workStatusTone(status)}>{workStatusLabel(status)}</StatusBadge>
        <SyncIndicator status={syncStatus} />
      </div>

      {attention ? <AttentionBanner text={attention} /> : null}

      <div className="pointer-events-auto flex h-8 items-center">{presence}</div>
    </div>
  );
}
