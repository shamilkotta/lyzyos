"use client";

import { X, Check, ArrowRight, ClockCounterClockwise } from "@phosphor-icons/react";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { activityFeed, agents, issueDetail, stageChecklist } from "@/lib/data";
import type { InspectorSelection } from "@/lib/types";
import clsx from "clsx";

type Props = {
  selection: InspectorSelection;
  open: boolean;
  onClose: () => void;
  onApplyFix?: () => void;
};

export function Inspector({ selection, open, onClose, onApplyFix }: Props) {
  if (!open) return null;

  return (
    <aside className="relative z-20 flex w-[var(--inspector-w)] shrink-0 flex-col border-l border-border bg-surface">
      <div className="flex h-11 items-center justify-between border-b border-border px-3">
        <span className="text-[12px] font-medium uppercase tracking-[0.05em] text-ink-tertiary">
          Inspector
        </span>
        <button
          type="button"
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-[6px] text-ink-tertiary hover:bg-surface-soft hover:text-ink"
        >
          <X size={14} weight="bold" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4">
        {selection.type === "none" ? <IdleState /> : null}
        {selection.type === "node" ? (
          <NodeDetail selection={selection} onApplyFix={onApplyFix} />
        ) : null}
        {selection.type === "attention" ? (
          <AttentionDetail item={selection.item} onApplyFix={onApplyFix} />
        ) : null}
      </div>
    </aside>
  );
}

function IdleState() {
  return (
    <div className="fade-up space-y-5">
      <div>
        <h2 className="font-serif text-[22px] leading-tight tracking-[-0.03em] text-ink">
          SecureEdge
        </h2>
        <p className="mt-1 text-[13px] text-ink-secondary">Northwind Security · Launch Nov 10</p>
      </div>

      <div className="space-y-2">
        {stageChecklist.map((item) => (
          <div
            key={item.label}
            className="flex items-center justify-between rounded-[8px] border border-border px-3 py-2"
          >
            <span className="text-[13px] text-ink">{item.label}</span>
            <StatusBadge
              tone={item.state === "complete" ? "ok" : item.state === "warn" ? "warn" : "neutral"}
            >
              {item.state === "complete" ? "Done" : item.state === "warn" ? "Attention" : "Queued"}
            </StatusBadge>
          </div>
        ))}
      </div>

      <section>
        <div className="mb-2 flex items-center gap-1.5 text-ink-tertiary">
          <ClockCounterClockwise size={13} weight="bold" />
          <span className="text-[11px] font-medium uppercase tracking-[0.05em]">
            Agent activity
          </span>
        </div>
        <ul className="space-y-0">
          {activityFeed.slice(0, 5).map((row) => (
            <li
              key={`${row.time}-${row.text}`}
              className="border-b border-border py-2.5 last:border-0"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-mono text-[11px] text-ink-tertiary">{row.time}</span>
                <StatusBadge tone={row.tone === "ok" ? "ok" : "warn"}>
                  {row.tone === "ok" ? "Done" : "Flag"}
                </StatusBadge>
              </div>
              <p className="mt-1 text-[12px] font-medium text-ink">{row.agent}</p>
              <p className="text-[12px] text-ink-secondary">{row.text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.05em] text-ink-tertiary">
          Agents in space
        </p>
        <ul className="space-y-2">
          {agents.slice(0, 3).map((agent) => (
            <li key={agent.id} className="rounded-[8px] border border-border px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13px] font-medium text-ink">{agent.name}</span>
                <span
                  className={clsx(
                    "h-1.5 w-1.5 rounded-full",
                    agent.status === "working"
                      ? "bg-pale-green-ink"
                      : agent.status === "waiting"
                        ? "bg-pale-yellow-ink"
                        : "bg-ink-tertiary",
                  )}
                />
              </div>
              <p className="mt-0.5 text-[12px] text-ink-secondary">{agent.lastAction}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function NodeDetail({
  selection,
  onApplyFix,
}: {
  selection: Extract<InspectorSelection, { type: "node" }>;
  onApplyFix?: () => void;
}) {
  const isBlockerOrClaim =
    selection.kind === "blocker" ||
    selection.id === "asset-li3" ||
    selection.id === "blocker-claim";

  if (isBlockerOrClaim) {
    return (
      <div className="fade-up space-y-4">
        <div>
          <StatusBadge tone="danger">{issueDetail.severity}</StatusBadge>
          <h2 className="mt-2 text-[16px] font-medium tracking-[-0.02em] text-ink">
            {issueDetail.title}
          </h2>
          <p className="mt-1 text-[12px] text-ink-secondary">{selection.title}</p>
        </div>

        <blockquote className="rounded-[8px] border border-border bg-canvas px-3 py-2.5 text-[13px] italic leading-relaxed text-ink">
          “{issueDetail.quote}”
        </blockquote>

        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.05em] text-ink-tertiary">
            Why this was flagged
          </p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-ink-secondary">{issueDetail.why}</p>
        </div>

        <div className="rounded-[8px] border border-border bg-pale-green px-3 py-2.5">
          <p className="text-[11px] font-medium uppercase tracking-[0.05em] text-pale-green-ink">
            Suggested replacement
          </p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-ink">{issueDetail.suggestion}</p>
          <p className="mt-2 font-mono text-[11px] text-ink-tertiary">
            Source · {issueDetail.source}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Button onClick={onApplyFix}>
            <Check size={14} weight="bold" />
            Apply suggestion
          </Button>
          <Button variant="secondary">Edit manually</Button>
          <Button variant="ghost">Request human review</Button>
        </div>
      </div>
    );
  }

  if (selection.kind === "agent") {
    return (
      <div className="fade-up space-y-4">
        <div>
          <StatusBadge tone="info">Agent</StatusBadge>
          <h2 className="mt-2 text-[16px] font-medium text-ink">{selection.title}</h2>
          <p className="mt-1 text-[13px] text-ink-secondary">{selection.subtitle}</p>
        </div>
        <div className="space-y-2 border-t border-border pt-3">
          <p className="text-[11px] font-medium uppercase tracking-[0.05em] text-ink-tertiary">
            Can
          </p>
          {["Create drafts", "Run QA checks", "Request approval", "Generate variations"].map(
            (item) => (
              <p key={item} className="flex items-center gap-2 text-[13px] text-ink">
                <Check size={13} className="text-pale-green-ink" weight="bold" />
                {item}
              </p>
            ),
          )}
          <p className="mt-3 text-[11px] font-medium uppercase tracking-[0.05em] text-ink-tertiary">
            Cannot
          </p>
          {["Approve legal content", "Publish campaigns"].map((item) => (
            <p key={item} className="flex items-center gap-2 text-[13px] text-ink-secondary">
              <X size={13} className="text-pale-red-ink" weight="bold" />
              {item}
            </p>
          ))}
        </div>
      </div>
    );
  }

  if (selection.kind === "launch") {
    return (
      <div className="fade-up space-y-4">
        <div>
          <StatusBadge tone="warn">Not ready</StatusBadge>
          <h2 className="mt-2 font-serif text-[28px] leading-none tracking-[-0.04em] text-ink">
            87
            <span className="text-[16px] text-ink-tertiary"> / 100</span>
          </h2>
          <p className="mt-2 text-[13px] text-ink-secondary">Two blockers remain before launch.</p>
        </div>
        <ul className="space-y-2">
          {[
            ["Creative", "ok"],
            ["Brand", "ok"],
            ["Compliance", "warn"],
            ["Germany", "danger"],
            ["Tracking", "ok"],
          ].map(([label, tone]) => (
            <li
              key={label}
              className="flex items-center justify-between border-b border-border py-2"
            >
              <span className="text-[13px] text-ink">{label}</span>
              <StatusBadge tone={tone === "ok" ? "ok" : tone === "danger" ? "danger" : "warn"}>
                {tone === "ok" ? "Ready" : tone === "danger" ? "Blocked" : "Review"}
              </StatusBadge>
            </li>
          ))}
        </ul>
        <Button variant="secondary">
          View blockers
          <ArrowRight size={14} weight="bold" />
        </Button>
      </div>
    );
  }

  return (
    <div className="fade-up space-y-3">
      <StatusBadge tone="neutral">{selection.kind}</StatusBadge>
      <h2 className="text-[16px] font-medium text-ink">{selection.title}</h2>
      {selection.subtitle ? (
        <p className="text-[13px] leading-relaxed text-ink-secondary">{selection.subtitle}</p>
      ) : null}
      <p className="text-[12px] text-ink-tertiary">
        Drag freely on the board. Agents can attach comments, blockers, and updates to this object.
      </p>
    </div>
  );
}

function AttentionDetail({
  item,
  onApplyFix,
}: {
  item: Extract<InspectorSelection, { type: "attention" }>["item"];
  onApplyFix?: () => void;
}) {
  return (
    <div className="fade-up space-y-4">
      <div>
        <StatusBadge
          tone={item.tone === "danger" ? "danger" : item.tone === "warn" ? "warn" : "info"}
        >
          {item.kind}
        </StatusBadge>
        <h2 className="mt-2 text-[16px] font-medium text-ink">{item.title}</h2>
        <p className="mt-1 text-[13px] text-ink-secondary">{item.reason}</p>
      </div>
      <Button onClick={onApplyFix}>Open on board</Button>
      <Button variant="secondary">Snooze</Button>
    </div>
  );
}
