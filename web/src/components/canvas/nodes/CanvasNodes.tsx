"use client";

import type { ReactNode } from "react";
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
import { DocMediaPreview, mediaKindFromPreview } from "@/components/docs/DocMediaPreview";
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
  label?: string;
};

/** Planning workspace cards — same chrome as project-home department nodes */
export type PlanningCardAction = {
  tone: StatusTone;
  variant: "needs_reply" | "answered";
};

export type PlanningCardData = {
  kind: "planning";
  title: string;
  summary: string;
  typeLabel: string;
  action?: PlanningCardAction;
  members: Member[];
  attention?: string;
  icon: "note" | "comment" | "doc";
  preview?: {
    kind: "image" | "pdf" | "video" | "audio" | "text" | "file";
    url?: string;
    text?: string;
    mime?: string;
  };
};

export type BoardNodeData = DepartmentNodeData | ItemNodeData | PlanningCardData;
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
        "rounded-[10px] border bg-surface px-3.5 pt-3 transition-[box-shadow,border-color] duration-200",
        selected
          ? "border-ink shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
          : "border-border hover:border-border-strong",
        !/\bpb-/.test(className ?? "") && "pb-3",
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

const planningActionTone: Record<StatusTone, string> = {
  neutral: "bg-surface-soft text-ink-secondary",
  ok: "bg-pale-green text-pale-green-ink",
  warn: "bg-pale-yellow text-pale-yellow-ink",
  danger: "bg-pale-red text-pale-red-ink",
  info: "bg-pale-blue text-pale-blue-ink",
};

function MemberAvatar({ member, size = "sm" }: { member: Member; size?: "sm" | "md" }) {
  const dim = size === "md" ? "h-6 w-6 text-[9px]" : "h-5 w-5 text-[8px]";
  return (
    <span
      title={`${member.name} · ${member.role}`}
      className={clsx(
        "flex shrink-0 items-center justify-center rounded-full border border-surface font-medium leading-none",
        dim,
        member.kind === "agent" ? "bg-pale-blue text-pale-blue-ink" : "bg-canvas text-ink",
      )}
    >
      {member.initials}
    </span>
  );
}

function MemberStack({ members }: { members: Member[] }) {
  return (
    <div className="flex items-center">
      {members.slice(0, 4).map((m, i) => (
        <span
          key={m.id}
          title={`${m.name} · ${m.role}`}
          className={clsx(
            "flex h-5 w-5 items-center justify-center rounded-full border border-surface text-[8px] font-medium leading-none",
            m.kind === "agent" ? "bg-pale-blue text-pale-blue-ink" : "bg-canvas text-ink",
            i > 0 && "-ml-1",
          )}
        >
          {m.initials}
        </span>
      ))}
      {members.length > 4 ? (
        <span className="-ml-1 flex h-5 w-5 items-center justify-center rounded-full border border-surface bg-surface-soft text-[8px] text-ink-tertiary">
          +{members.length - 4}
        </span>
      ) : null}
    </div>
  );
}

/** Shared footer for project-home department cards and planning workspace cards */
function CardNodeFooter({ members, action }: { members: Member[]; action?: ReactNode }) {
  return (
    <div className="mt-2 flex items-center justify-between gap-2 border-t border-border pt-1 pb-2">
      <MemberStack members={members} />
      {action}
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
    <NodeShell selected={selected} width={260} className="pb-0">
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

      <h3 className="truncate text-[15px] font-medium tracking-[-0.02em] text-ink">{data.title}</h3>
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

      <CardNodeFooter
        members={data.members}
        action={
          <span
            data-open-workspace=""
            className="nodrag nopan inline-flex cursor-pointer items-center gap-0.5 text-[10px] font-medium text-ink hover:underline"
          >
            {data.openLabel ?? "Open"}
            <ArrowRight size={11} weight="bold" />
          </span>
        }
      />
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
      <h3 className="truncate text-[13px] font-medium text-ink">{data.title}</h3>
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
      <h3 className="truncate text-[13px] font-medium text-ink">{data.title}</h3>
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
        <span className="text-[11px] font-medium uppercase tracking-[0.05em]">
          {data.label ?? "Comment"}
        </span>
      </div>
      <p className="truncate text-[13px] leading-relaxed text-ink">{data.title}</p>
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
      <p className="truncate text-[13px] leading-relaxed text-ink">{data.title}</p>
      {data.body ? (
        <p className="mt-1 line-clamp-3 text-[12px] leading-relaxed text-ink-secondary">
          {data.body}
        </p>
      ) : null}
      <AuthorRow name={data.authorName} initials={data.authorInitials} kind={data.authorKind} />
    </NodeShell>
  );
}

function DocPreview({
  preview,
  title,
  className,
}: {
  preview: NonNullable<PlanningCardData["preview"]>;
  title?: string;
  className?: string;
}) {
  if (
    preview.url &&
    (preview.kind === "image" || preview.kind === "pdf" || preview.kind === "file")
  ) {
    return (
      <DocMediaPreview
        url={preview.url}
        kind={mediaKindFromPreview(preview.kind, preview.mime)}
        mime={preview.mime}
        title={title}
        size="card"
        className={className ?? "mt-2"}
      />
    );
  }

  if (preview.kind === "video" && preview.url) {
    return (
      <div className="mt-2 overflow-hidden rounded-[6px] border border-border bg-canvas">
        <video
          src={preview.url}
          className="h-24 w-full object-cover"
          muted
          playsInline
          preload="metadata"
        />
      </div>
    );
  }

  if (preview.kind === "audio" && preview.url) {
    return (
      <div className="mt-2 rounded-[6px] border border-border bg-canvas px-2 py-2">
        <audio src={preview.url} controls preload="metadata" className="h-8 w-full" />
      </div>
    );
  }

  if (preview.kind === "text" && preview.text) {
    return (
      <div className="mt-2 rounded-[6px] border border-border bg-canvas px-2.5 py-2">
        <p className="line-clamp-4 font-mono text-[10px] leading-relaxed text-ink-secondary whitespace-pre-wrap">
          {preview.text}
        </p>
      </div>
    );
  }

  return (
    <div className="mt-2 flex h-16 items-center justify-center rounded-[6px] border border-dashed border-border bg-canvas text-[11px] text-ink-tertiary">
      {preview.mime?.split("/")[1]?.toUpperCase() || "FILE"}
    </div>
  );
}

function PlanningActionIcon({ action }: { action: PlanningCardAction }) {
  const label = action.variant === "answered" ? "Answered" : "Needs reply";
  const Icon = action.variant === "answered" ? CheckCircle : WarningCircle;
  return (
    <span
      title={label}
      aria-label={label}
      className={clsx(
        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
        planningActionTone[action.tone],
      )}
    >
      <Icon size={13} weight="fill" />
    </span>
  );
}

export function PlanningCardNode({ data, selected }: NodeProps<Node<PlanningCardData>>) {
  const KindIcon =
    data.icon === "doc" ? Cube : data.icon === "comment" ? ChatCircleText : NoteBlank;
  const author = data.members[0];
  const isDoc = data.icon === "doc";
  const showTitle = data.title.trim().length > 0;

  return (
    <NodeShell selected={selected} width={260}>
      <Handles />
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <span className="inline-flex max-w-full items-center gap-1 rounded-full bg-surface-soft py-0.5 pl-1 pr-2 text-[10px] font-medium uppercase tracking-[0.05em] text-ink-secondary">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface text-ink">
              <KindIcon size={12} weight="bold" />
            </span>
            <span className="truncate">{data.typeLabel}</span>
          </span>
          {data.action ? <PlanningActionIcon action={data.action} /> : null}
        </div>
        {author ? <MemberAvatar member={author} size="md" /> : null}
      </div>

      {showTitle ? (
        <h3 className="truncate text-[15px] font-medium tracking-[-0.02em] text-ink">
          {data.title}
        </h3>
      ) : null}
      {!isDoc && data.summary ? (
        <p
          className={clsx(
            "line-clamp-3 text-[12px] leading-relaxed text-ink-secondary",
            showTitle && "mt-1",
          )}
        >
          {data.summary}
        </p>
      ) : null}

      {data.preview ? (
        <DocPreview
          preview={data.preview}
          title={data.title}
          className={showTitle || !isDoc ? "mt-2" : "mt-0.5"}
        />
      ) : null}

      {data.attention ? (
        <p className="mt-2 rounded-[6px] bg-pale-yellow px-2 py-1.5 text-[11px] leading-snug text-pale-yellow-ink">
          {data.attention}
        </p>
      ) : null}
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
      <h3 className="truncate text-[13px] font-medium text-ink">{data.title}</h3>
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
      <h3 className="truncate text-[13px] font-medium text-ink">{data.title}</h3>
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

export const planningNodeTypes = {
  planning: PlanningCardNode,
};
