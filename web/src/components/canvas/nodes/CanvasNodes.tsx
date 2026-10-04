"use client";

import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import {
  FileText,
  Cube,
  Robot,
  ChatCircleText,
  WarningCircle,
  NoteBlank,
  Flag,
  RocketLaunch,
  CheckCircle,
  CircleDashed,
} from "@phosphor-icons/react";
import clsx from "clsx";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { NodeKind, StatusTone } from "@/lib/types";

export type BoardNodeData = {
  kind: NodeKind;
  title: string;
  subtitle?: string;
  meta?: string;
  tone?: StatusTone;
  agentStatus?: "idle" | "working" | "waiting";
  checklist?: { label: string; done?: boolean; warn?: boolean }[];
  selected?: boolean;
};

export type BoardNode = Node<BoardNodeData>;

function NodeShell({
  children,
  selected,
  className,
  width = 240,
}: {
  children: React.ReactNode;
  selected?: boolean;
  className?: string;
  width?: number;
}) {
  return (
    <div
      style={{ width }}
      className={clsx(
        "rounded-[10px] border bg-surface px-3.5 py-3 transition-[box-shadow,border-color] duration-200",
        selected
          ? "border-ink shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
          : "border-border hover:border-border-strong",
        className,
      )}
    >
      {children}
    </div>
  );
}

function Handles() {
  return (
    <>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
    </>
  );
}

export function BriefNode({ data, selected }: NodeProps<BoardNode>) {
  return (
    <NodeShell selected={selected} width={280}>
      <Handles />
      <div className="mb-2 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-[6px] bg-pale-blue text-pale-blue-ink">
          <FileText size={15} weight="bold" />
        </span>
        <StatusBadge tone="info">Brief</StatusBadge>
      </div>
      <h3 className="text-[14px] font-medium leading-snug tracking-[-0.01em] text-ink">
        {data.title}
      </h3>
      {data.subtitle ? (
        <p className="mt-1.5 text-[12px] leading-relaxed text-ink-secondary">{data.subtitle}</p>
      ) : null}
      {data.meta ? (
        <p className="mt-2 font-mono text-[11px] text-ink-tertiary">{data.meta}</p>
      ) : null}
    </NodeShell>
  );
}

export function StageNode({ data, selected }: NodeProps<BoardNode>) {
  const icon =
    data.tone === "ok" ? (
      <CheckCircle size={14} weight="fill" className="text-pale-green-ink" />
    ) : data.tone === "warn" ? (
      <WarningCircle size={14} weight="fill" className="text-pale-yellow-ink" />
    ) : (
      <CircleDashed size={14} weight="bold" className="text-ink-tertiary" />
    );

  return (
    <NodeShell selected={selected} width={200}>
      <Handles />
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-[13px] font-medium text-ink">{data.title}</span>
        </div>
        {data.tone ? (
          <StatusBadge tone={data.tone === "ok" ? "ok" : data.tone === "warn" ? "warn" : "neutral"}>
            {data.tone === "ok" ? "Done" : data.tone === "warn" ? "Needs you" : "Next"}
          </StatusBadge>
        ) : null}
      </div>
      {data.subtitle ? (
        <p className="mt-2 text-[12px] text-ink-secondary">{data.subtitle}</p>
      ) : null}
    </NodeShell>
  );
}

export function AssetNode({ data, selected }: NodeProps<BoardNode>) {
  return (
    <NodeShell selected={selected} width={220}>
      <Handles />
      <div className="mb-2 flex items-center justify-between">
        <span className="flex h-7 w-7 items-center justify-center rounded-[6px] bg-surface-soft text-ink">
          <Cube size={15} weight="bold" />
        </span>
        {data.tone ? (
          <StatusBadge tone={data.tone}>
            {data.tone === "ok" ? "Passed" : data.tone === "danger" ? "Failed" : "Review"}
          </StatusBadge>
        ) : null}
      </div>
      <h3 className="text-[13px] font-medium text-ink">{data.title}</h3>
      {data.subtitle ? (
        <p className="mt-1 text-[12px] text-ink-secondary">{data.subtitle}</p>
      ) : null}
      <div className="mt-3 h-16 rounded-[6px] border border-border bg-canvas" />
    </NodeShell>
  );
}

export function AgentNode({ data, selected }: NodeProps<BoardNode>) {
  const pulse =
    data.agentStatus === "working"
      ? "bg-pale-green-ink"
      : data.agentStatus === "waiting"
        ? "bg-pale-yellow-ink"
        : "bg-ink-tertiary";

  return (
    <NodeShell selected={selected} width={230} className="bg-surface-soft">
      <Handles />
      <div className="mb-2 flex items-center gap-2">
        <span className="relative flex h-7 w-7 items-center justify-center rounded-[6px] bg-pale-blue text-pale-blue-ink">
          <Robot size={15} weight="fill" />
          <span
            className={clsx(
              "absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full ring-2 ring-surface-soft",
              pulse,
            )}
          />
        </span>
        <StatusBadge tone="info">Agent</StatusBadge>
      </div>
      <h3 className="text-[13px] font-medium text-ink">{data.title}</h3>
      <p className="mt-1 text-[12px] text-ink-secondary">{data.subtitle}</p>
      {data.meta ? (
        <p className="mt-2 font-mono text-[11px] text-ink-tertiary">{data.meta}</p>
      ) : null}
    </NodeShell>
  );
}

export function CommentNode({ data, selected }: NodeProps<BoardNode>) {
  return (
    <NodeShell selected={selected} width={220} className="bg-pale-yellow">
      <Handles />
      <div className="mb-1.5 flex items-center gap-1.5 text-pale-yellow-ink">
        <ChatCircleText size={14} weight="bold" />
        <span className="text-[11px] font-medium uppercase tracking-[0.05em]">Comment</span>
      </div>
      <p className="text-[13px] leading-relaxed text-ink">{data.title}</p>
      {data.subtitle ? (
        <p className="mt-2 text-[11px] text-ink-secondary">{data.subtitle}</p>
      ) : null}
    </NodeShell>
  );
}

export function BlockerNode({ data, selected }: NodeProps<BoardNode>) {
  return (
    <NodeShell selected={selected} width={240} className="border-pale-red-ink/20 bg-pale-red">
      <Handles />
      <div className="mb-1.5 flex items-center gap-1.5 text-pale-red-ink">
        <WarningCircle size={14} weight="fill" />
        <span className="text-[11px] font-medium uppercase tracking-[0.05em]">Blocker</span>
      </div>
      <h3 className="text-[13px] font-medium text-ink">{data.title}</h3>
      {data.subtitle ? (
        <p className="mt-1.5 text-[12px] leading-relaxed text-pale-red-ink">{data.subtitle}</p>
      ) : null}
    </NodeShell>
  );
}

export function NoteNode({ data, selected }: NodeProps<BoardNode>) {
  return (
    <NodeShell selected={selected} width={200}>
      <Handles />
      <div className="mb-1.5 flex items-center gap-1.5 text-ink-secondary">
        <NoteBlank size={14} weight="bold" />
        <span className="text-[11px] font-medium uppercase tracking-[0.05em]">Note</span>
      </div>
      <p className="text-[13px] leading-relaxed text-ink">{data.title}</p>
    </NodeShell>
  );
}

export function MarketNode({ data, selected }: NodeProps<BoardNode>) {
  return (
    <NodeShell selected={selected} width={180}>
      <Handles />
      <div className="mb-2 flex items-center justify-between">
        <span className="flex h-7 w-7 items-center justify-center rounded-[6px] bg-surface-soft">
          <Flag size={14} weight="bold" />
        </span>
        {data.tone ? <StatusBadge tone={data.tone}>{data.meta}</StatusBadge> : null}
      </div>
      <h3 className="text-[13px] font-medium text-ink">{data.title}</h3>
      {data.subtitle ? (
        <p className="mt-1 text-[12px] text-ink-secondary">{data.subtitle}</p>
      ) : null}
    </NodeShell>
  );
}

export function LaunchNode({ data, selected }: NodeProps<BoardNode>) {
  return (
    <NodeShell selected={selected} width={210}>
      <Handles />
      <div className="mb-2 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-[6px] bg-ink text-white">
          <RocketLaunch size={14} weight="bold" />
        </span>
        <StatusBadge tone={data.tone ?? "neutral"}>Launch</StatusBadge>
      </div>
      <h3 className="text-[13px] font-medium text-ink">{data.title}</h3>
      {data.subtitle ? (
        <p className="mt-1 text-[12px] text-ink-secondary">{data.subtitle}</p>
      ) : null}
    </NodeShell>
  );
}

export const nodeTypes = {
  brief: BriefNode,
  stage: StageNode,
  asset: AssetNode,
  agent: AgentNode,
  comment: CommentNode,
  blocker: BlockerNode,
  note: NoteNode,
  market: MarketNode,
  launch: LaunchNode,
};
