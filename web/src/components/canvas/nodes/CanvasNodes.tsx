"use client";

import { memo, type ReactNode } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import {
  ArrowRight,
  ChatCircleText,
  CheckCircle,
  CircleDashed,
  Cube,
  NoteBlank,
  SquaresFour,
  WarningCircle,
} from "@phosphor-icons/react";
import clsx from "clsx";
import { DocMediaPreview, mediaKindFromPreview } from "@/components/docs/DocMediaPreview";
import { Avatar } from "@/components/ui/Avatar";
import { Markdown } from "@/components/ui/Markdown";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { workStatusLabel } from "@/lib/status";
import type { Member, StatusTone, WorkStatus } from "@/lib/types";

/** A workspace card on the project overview graph. */
export type WorkspaceSummaryData = {
  title: string;
  summary: string;
  tone: StatusTone;
  status: WorkStatus;
  members: Member[];
  attention?: string;
};

export type BoardCardKind = "note" | "comment" | "doc";

/** A note / comment thread / document card on a workspace board. */
export type BoardCardData = {
  title: string;
  summary: string;
  typeLabel: string;
  members: Member[];
  icon: BoardCardKind;
  preview?: {
    kind: "image" | "pdf" | "video" | "audio" | "text" | "file";
    url?: string;
    text?: string;
    mime?: string;
  };
};

export type WorkspaceSummaryNode = Node<WorkspaceSummaryData, "workspace">;
export type BoardCardNode = Node<BoardCardData, "board">;

/** Marks the in-card "Open" affordance so click handlers can tell it apart from a select. */
export const OPEN_WORKSPACE_ATTR = "data-open-workspace";

function NodeShell({
  children,
  selected,
  className,
  width,
}: {
  children: ReactNode;
  selected?: boolean;
  className?: string;
  width: number;
}) {
  return (
    <div
      style={{ width }}
      className={clsx(
        "rounded-[10px] border bg-surface px-3.5 pt-3 transition-[box-shadow,border-color] duration-200",
        selected
          ? "border-ink shadow-[var(--shadow-soft)]"
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

const SIZE = {
  sm: "h-5 w-5 text-[8px]",
  md: "h-6 w-6 text-[9px]",
} as const;

export function MemberAvatar({
  member,
  size = "sm",
}: {
  member: Member;
  size?: keyof typeof SIZE;
}) {
  return (
    <Avatar
      name={member.name}
      image={member.image}
      title={`${member.name} · ${member.role}`}
      className={clsx("border border-surface", SIZE[size])}
    />
  );
}

export function MemberStack({
  members,
  size = "sm",
  max = 3,
}: {
  members: Member[];
  size?: keyof typeof SIZE;
  max?: number;
}) {
  const visible = members.slice(0, max);
  const overflow = members.length - visible.length;

  return (
    <div className="flex items-center">
      {visible.map((m, i) => (
        <span key={m.id} className={clsx(i > 0 && "-ml-2.5")}>
          <MemberAvatar member={m} size={size} />
        </span>
      ))}
      {overflow > 0 ? (
        <span
          title={`${overflow} more`}
          className={clsx(
            "-ml-2.5 flex items-center justify-center rounded-full border border-surface bg-surface-soft font-medium leading-none text-ink-tertiary",
            SIZE[size],
          )}
        >
          +{overflow}
        </span>
      ) : null}
    </div>
  );
}

function ToneIcon({ tone }: { tone: StatusTone }) {
  if (tone === "ok") return <CheckCircle size={14} weight="fill" className="text-pale-green-ink" />;
  if (tone === "danger") {
    return <WarningCircle size={14} weight="fill" className="text-pale-red-ink" />;
  }
  if (tone === "warn") {
    return <WarningCircle size={14} weight="fill" className="text-pale-yellow-ink" />;
  }
  return <CircleDashed size={14} weight="bold" className="text-ink-tertiary" />;
}

export const WorkspaceSummaryCard = memo(function WorkspaceSummaryCard({
  data,
  selected,
}: NodeProps<WorkspaceSummaryNode>) {
  return (
    <NodeShell selected={selected} width={260}>
      <Handles />
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-[6px] bg-surface-soft text-ink">
            <SquaresFour size={14} weight="bold" />
          </span>
          <ToneIcon tone={data.tone} />
        </div>
        <StatusBadge tone={data.tone}>{workStatusLabel(data.status)}</StatusBadge>
      </div>

      <h3 className="truncate text-[15px] font-medium tracking-[-0.02em] text-ink">{data.title}</h3>
      <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-ink-secondary">
        {data.summary}
      </p>

      {data.attention ? (
        <div className="mt-2 rounded-[6px] bg-pale-yellow px-2 py-1.5">
          <p className="line-clamp-2 text-[11px] leading-snug text-pale-yellow-ink">
            {data.attention}
          </p>
        </div>
      ) : null}

      <div className="mt-2 flex items-center justify-between gap-2 border-t border-border pb-2 pt-1">
        <MemberStack members={data.members} />
        <span
          {...{ [OPEN_WORKSPACE_ATTR]: "" }}
          className="nodrag nopan inline-flex cursor-pointer items-center gap-0.5 text-[10px] font-medium text-ink hover:underline"
        >
          Open
          <ArrowRight size={11} weight="bold" />
        </span>
      </div>
    </NodeShell>
  );
});

function DocPreview({
  preview,
  title,
  className,
}: {
  preview: NonNullable<BoardCardData["preview"]>;
  title?: string;
  className: string;
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
        className={className}
      />
    );
  }

  if (preview.kind === "video" && preview.url) {
    return (
      <div
        className={clsx("overflow-hidden rounded-[6px] border border-border bg-canvas", className)}
      >
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
      <div className={clsx("rounded-[6px] border border-border bg-canvas px-2 py-2", className)}>
        <audio src={preview.url} controls preload="none" className="h-8 w-full" />
      </div>
    );
  }

  if (preview.kind === "text" && preview.text) {
    return (
      <div className={clsx("rounded-[6px] border border-border bg-canvas px-2.5 py-2", className)}>
        <p className="line-clamp-4 whitespace-pre-wrap font-mono text-[10px] leading-relaxed text-ink-secondary">
          {preview.text}
        </p>
      </div>
    );
  }

  return (
    <div
      className={clsx(
        "flex h-16 items-center justify-center rounded-[6px] border border-dashed border-border bg-canvas text-[11px] text-ink-tertiary",
        className,
      )}
    >
      {preview.mime?.split("/")[1]?.toUpperCase() || "FILE"}
    </div>
  );
}

const KIND_CHIP: Record<BoardCardKind, string> = {
  comment: "bg-pale-yellow text-pale-yellow-ink",
  doc: "bg-pale-blue text-pale-blue-ink",
  note: "bg-surface-soft text-ink-secondary",
};

const KIND_ICON = { doc: Cube, comment: ChatCircleText, note: NoteBlank } as const;

export const BoardCard = memo(function BoardCard({ data, selected }: NodeProps<BoardCardNode>) {
  const KindIcon = KIND_ICON[data.icon];
  const author = data.members[0];
  const isDoc = data.icon === "doc";
  const showTitle = data.title.trim().length > 0;

  return (
    <NodeShell selected={selected} width={260} className="node-enter pb-3">
      <Handles />
      <div className="mb-2 flex items-start justify-between gap-2">
        <span
          className={clsx(
            "inline-flex max-w-full items-center gap-1 rounded-full py-0.5 pl-1 pr-2 text-[10px] font-medium uppercase tracking-[0.05em]",
            KIND_CHIP[data.icon],
          )}
        >
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface text-ink">
            <KindIcon size={12} weight="bold" />
          </span>
          <span className="truncate">{data.typeLabel}</span>
        </span>
        {data.icon === "comment" && data.members.length > 0 ? (
          <MemberStack members={data.members} size="md" max={3} />
        ) : author ? (
          <MemberAvatar member={author} size="md" />
        ) : null}
      </div>

      {showTitle ? (
        <h3 className="truncate text-[15px] font-medium tracking-[-0.02em] text-ink">
          {data.title}
        </h3>
      ) : null}
      {!isDoc && data.summary ? (
        <div
          className={clsx(
            "relative max-h-[76px] overflow-hidden [mask-image:linear-gradient(to_bottom,black_70%,transparent)]",
            showTitle && "mt-1",
          )}
        >
          <Markdown variant="compact">{data.summary}</Markdown>
        </div>
      ) : null}

      {data.preview ? (
        <DocPreview
          preview={data.preview}
          title={data.title}
          className={showTitle || !isDoc ? "mt-2" : "mt-0.5"}
        />
      ) : null}
    </NodeShell>
  );
});

export const overviewNodeTypes = { workspace: WorkspaceSummaryCard };
export const boardNodeTypes = { board: BoardCard };
