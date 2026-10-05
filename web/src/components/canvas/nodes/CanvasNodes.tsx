"use client";

import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import {
  Buildings,
  Cube,
  ChatCircleText,
  WarningCircle,
  NoteBlank,
  CheckCircle,
  CircleDashed,
  ArrowRight,
  ListChecks,
  Path,
} from "@phosphor-icons/react";
import clsx from "clsx";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { BranchItemKind, Member, StatusTone, WorkStatus } from "@/lib/types";

export type DepartmentNodeData = {
  kind: "department";
  title: string;
  summary: string;
  tone: StatusTone;
  status: WorkStatus;
  members: Member[];
  branchCount?: number;
  attention?: string;
  openLabel?: string;
};

export type ItemNodeData = {
  kind: BranchItemKind;
  title: string;
  body?: string;
  tone?: StatusTone;
  meta?: string;
  authorName?: string;
  authorKind?: "human" | "agent";
  authorInitials?: string;
};

export type BoardNodeData = DepartmentNodeData | ItemNodeData;
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

function statusLabel(status: WorkStatus) {
  switch (status) {
    case "complete":
      return "Done";
    case "ready":
      return "Ready";
    case "blocked":
      return "Blocked";
    case "in_review":
      return "In review";
    case "in_progress":
      return "In progress";
    default:
      return "Queued";
  }
}

function MemberStack({ members }: { members: Member[] }) {
  return (
    <div className="flex items-center">
      {members.slice(0, 4).map((m, i) => (
        <span
          key={m.id}
          title={`${m.name} · ${m.role}`}
          className={clsx(
            "flex h-6 w-6 items-center justify-center rounded-full border border-surface text-[9px] font-medium",
            m.kind === "agent" ? "bg-pale-blue text-pale-blue-ink" : "bg-canvas text-ink",
            i > 0 && "-ml-1.5",
          )}
        >
          {m.initials}
        </span>
      ))}
      {members.length > 4 ? (
        <span className="-ml-1.5 flex h-6 w-6 items-center justify-center rounded-full border border-surface bg-surface-soft text-[9px] text-ink-tertiary">
          +{members.length - 4}
        </span>
      ) : null}
    </div>
  );
}

export function DepartmentNode({ data, selected }: NodeProps<Node<DepartmentNodeData>>) {
  const icon =
    data.tone === "ok" ? (
      <CheckCircle size={14} weight="fill" className="text-pale-green-ink" />
    ) : data.tone === "danger" ? (
      <WarningCircle size={14} weight="fill" className="text-pale-red-ink" />
    ) : data.tone === "warn" ? (
      <WarningCircle size={14} weight="fill" className="text-pale-yellow-ink" />
    ) : (
      <CircleDashed size={14} weight="bold" className="text-ink-tertiary" />
    );

  return (
    <NodeShell selected={selected} width={260}>
      <Handles />
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-[6px] bg-surface-soft text-ink">
            <Buildings size={14} weight="bold" />
          </span>
          {icon}
        </div>
        <StatusBadge tone={data.tone}>{statusLabel(data.status)}</StatusBadge>
      </div>

      <h3 className="text-[15px] font-medium tracking-[-0.02em] text-ink">{data.title}</h3>
      <p className="mt-1 text-[12px] leading-relaxed text-ink-secondary">{data.summary}</p>

      {data.attention ? (
        <p className="mt-2 rounded-[6px] bg-pale-yellow px-2 py-1.5 text-[11px] leading-snug text-pale-yellow-ink">
          {data.attention}
        </p>
      ) : null}

      {data.branchCount ? (
        <p className="mt-2 flex items-center gap-1 text-[11px] text-ink-tertiary">
          <Path size={12} weight="bold" />
          {data.branchCount} lanes
        </p>
      ) : null}

      <div className="mt-3 flex items-center justify-between border-t border-border pt-2.5">
        <MemberStack members={data.members} />
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-ink">
          Open
          <ArrowRight size={12} weight="bold" />
        </span>
      </div>
    </NodeShell>
  );
}

function AuthorRow({
  name,
  initials,
  kind,
  meta,
}: {
  name?: string;
  initials?: string;
  kind?: "human" | "agent";
  meta?: string;
}) {
  if (!name) return null;
  return (
    <div className="mt-2 flex items-center gap-1.5 text-[11px] text-ink-tertiary">
      <span
        className={clsx(
          "flex h-5 w-5 items-center justify-center rounded-full text-[8px] font-medium",
          kind === "agent" ? "bg-pale-blue text-pale-blue-ink" : "bg-canvas text-ink",
        )}
      >
        {initials}
      </span>
      <span className="truncate text-ink-secondary">{name}</span>
      {meta ? <span className="font-mono">· {meta}</span> : null}
    </div>
  );
}

export function WorkNode({ data, selected }: NodeProps<Node<ItemNodeData>>) {
  return (
    <NodeShell selected={selected} width={240}>
      <Handles />
      <div className="mb-2 flex items-center justify-between">
        <span className="flex h-7 w-7 items-center justify-center rounded-[6px] bg-surface-soft">
          <ListChecks size={14} weight="bold" />
        </span>
        {data.tone ? <StatusBadge tone={data.tone}>{data.meta ?? "Work"}</StatusBadge> : null}
      </div>
      <h3 className="text-[13px] font-medium text-ink">{data.title}</h3>
      {data.body ? (
        <p className="mt-1 text-[12px] leading-relaxed text-ink-secondary">{data.body}</p>
      ) : null}
      <AuthorRow
        name={data.authorName}
        initials={data.authorInitials}
        kind={data.authorKind}
        meta={data.meta && !data.tone ? data.meta : undefined}
      />
    </NodeShell>
  );
}

export function AssetNode({ data, selected }: NodeProps<Node<ItemNodeData>>) {
  return (
    <NodeShell selected={selected} width={220}>
      <Handles />
      <div className="mb-2 flex items-center justify-between">
        <span className="flex h-7 w-7 items-center justify-center rounded-[6px] bg-surface-soft">
          <Cube size={14} weight="bold" />
        </span>
        {data.tone ? <StatusBadge tone={data.tone}>{data.meta ?? "Asset"}</StatusBadge> : null}
      </div>
      <h3 className="text-[13px] font-medium text-ink">{data.title}</h3>
      {data.body ? <p className="mt-1 text-[12px] text-ink-secondary">{data.body}</p> : null}
      <div className="mt-3 h-14 rounded-[6px] border border-border bg-canvas" />
      <AuthorRow name={data.authorName} initials={data.authorInitials} kind={data.authorKind} />
    </NodeShell>
  );
}

export function CommentNode({ data, selected }: NodeProps<Node<ItemNodeData>>) {
  return (
    <NodeShell selected={selected} width={230} className="bg-pale-yellow">
      <Handles />
      <div className="mb-1.5 flex items-center gap-1.5 text-pale-yellow-ink">
        <ChatCircleText size={14} weight="bold" />
        <span className="text-[11px] font-medium uppercase tracking-[0.05em]">Comment</span>
      </div>
      <p className="text-[13px] leading-relaxed text-ink">{data.title}</p>
      <AuthorRow
        name={data.authorName}
        initials={data.authorInitials}
        kind={data.authorKind}
        meta={data.meta}
      />
    </NodeShell>
  );
}

export function NoteNode({ data, selected }: NodeProps<Node<ItemNodeData>>) {
  return (
    <NodeShell selected={selected} width={210}>
      <Handles />
      <div className="mb-1.5 flex items-center gap-1.5 text-ink-secondary">
        <NoteBlank size={14} weight="bold" />
        <span className="text-[11px] font-medium uppercase tracking-[0.05em]">Note</span>
      </div>
      <p className="text-[13px] leading-relaxed text-ink">{data.title}</p>
      <AuthorRow name={data.authorName} initials={data.authorInitials} kind={data.authorKind} />
    </NodeShell>
  );
}

export function InstructionNode({ data, selected }: NodeProps<Node<ItemNodeData>>) {
  return (
    <NodeShell selected={selected} width={250} className="bg-pale-blue/40">
      <Handles />
      <div className="mb-1.5 flex items-center gap-1.5 text-pale-blue-ink">
        <Path size={14} weight="bold" />
        <span className="text-[11px] font-medium uppercase tracking-[0.05em]">Instruction</span>
      </div>
      <h3 className="text-[13px] font-medium text-ink">{data.title}</h3>
      {data.body ? (
        <p className="mt-1 text-[12px] leading-relaxed text-ink-secondary">{data.body}</p>
      ) : null}
      <AuthorRow name={data.authorName} initials={data.authorInitials} kind={data.authorKind} />
    </NodeShell>
  );
}

export function BlockerNode({ data, selected }: NodeProps<Node<ItemNodeData>>) {
  return (
    <NodeShell selected={selected} width={240} className="border-pale-red-ink/20 bg-pale-red">
      <Handles />
      <div className="mb-1.5 flex items-center gap-1.5 text-pale-red-ink">
        <WarningCircle size={14} weight="fill" />
        <span className="text-[11px] font-medium uppercase tracking-[0.05em]">Blocker</span>
      </div>
      <h3 className="text-[13px] font-medium text-ink">{data.title}</h3>
      {data.body ? (
        <p className="mt-1.5 text-[12px] leading-relaxed text-pale-red-ink">{data.body}</p>
      ) : null}
      <AuthorRow name={data.authorName} initials={data.authorInitials} kind={data.authorKind} />
    </NodeShell>
  );
}

export const overviewNodeTypes = {
  department: DepartmentNode,
};

export const branchNodeTypes = {
  work: WorkNode,
  asset: AssetNode,
  comment: CommentNode,
  note: NoteNode,
  instruction: InstructionNode,
  blocker: BlockerNode,
};
