"use client";

import { WarningCircle, X } from "@phosphor-icons/react";
import { attentionQueue } from "@/lib/data";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { AttentionItem } from "@/lib/types";

type Props = {
  open: boolean;
  onClose: () => void;
  onSelect: (item: AttentionItem) => void;
};

export function AttentionTray({ open, onClose, onSelect }: Props) {
  if (!open) return null;

  return (
    <div className="absolute right-4 top-[56px] z-30 w-[320px] overflow-hidden rounded-[12px] border border-border bg-surface shadow-[0_2px_8px_rgba(0,0,0,0.04)] fade-up">
      <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
        <div className="flex items-center gap-1.5">
          <WarningCircle size={14} weight="fill" className="text-pale-yellow-ink" />
          <span className="text-[12px] font-medium uppercase tracking-[0.05em] text-ink-tertiary">
            Needs your decision
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-6 w-6 items-center justify-center rounded-[5px] text-ink-tertiary hover:bg-surface-soft"
        >
          <X size={12} weight="bold" />
        </button>
      </div>
      <ul>
        {attentionQueue.map((item) => (
          <li key={item.id} className="border-b border-border last:border-0">
            <button
              type="button"
              onClick={() => onSelect(item)}
              className="w-full px-3 py-3 text-left transition-colors hover:bg-surface-soft"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[12px] text-ink-tertiary">{item.campaignName}</span>
                <StatusBadge
                  tone={item.tone === "danger" ? "danger" : item.tone === "warn" ? "warn" : "info"}
                >
                  {item.kind}
                </StatusBadge>
              </div>
              <p className="mt-1 text-[13px] font-medium text-ink">{item.title}</p>
              <p className="mt-0.5 text-[12px] text-ink-secondary">{item.reason}</p>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
