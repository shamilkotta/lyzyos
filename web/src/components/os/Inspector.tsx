"use client";

import { useEffect, useState } from "react";
import { Check, ArrowRight, Users } from "@phosphor-icons/react";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { FloatingPanel } from "@/components/os/FloatingPanel";
import { departments, getDepartment, issueDetail, membersForDepartment } from "@/lib/data";
import type { DepartmentId, InspectorSelection, Member } from "@/lib/types";
import clsx from "clsx";

type Props = {
  selection: InspectorSelection;
  open: boolean;
  onClose: () => void;
  onOpenDepartment?: (id: DepartmentId) => void;
  onOpenWorkspace?: (workspaceId: string) => void;
  onApplyFix?: () => void;
  mode: "overview" | "branch";
  departmentId?: DepartmentId;
};

function inspectorTitle(selection: InspectorSelection, mode: Props["mode"]) {
  if (selection.type === "department") return "Department";
  if (selection.type === "workspace") return "Workspace";
  if (selection.type === "item") return selection.kind;
  if (selection.type === "member") return "Teammate";
  if (selection.type === "attention") return "Attention";
  return mode === "branch" ? "Workspace" : "Inspector";
}

export function Inspector({
  selection,
  open,
  onClose,
  onOpenDepartment,
  onOpenWorkspace,
  onApplyFix,
  mode,
  departmentId,
}: Props) {
  const [collapsed, setCollapsed] = useState(false);

  const selectionKey =
    selection.type === "none"
      ? "none"
      : selection.type === "department" || selection.type === "workspace"
        ? selection.id
        : selection.type === "item"
          ? selection.id
          : selection.type === "member"
            ? selection.member.id
            : selection.item.id;

  useEffect(() => {
    if (selectionKey !== "none") setCollapsed(false);
  }, [selectionKey]);

  if (!open) return null;

  return (
    <FloatingPanel
      title={inspectorTitle(selection, mode)}
      subtitle="Details"
      collapsed={collapsed}
      onCollapsedChange={setCollapsed}
      onClose={onClose}
    >
      {selection.type === "none" && mode === "overview" ? <CampaignPulse /> : null}
      {selection.type === "none" && mode === "branch" && departmentId ? (
        <DepartmentPulse id={departmentId} />
      ) : null}
      {selection.type === "department" ? (
        <DepartmentDetail id={selection.id} onOpen={() => onOpenDepartment?.(selection.id)} />
      ) : null}
      {selection.type === "workspace" ? (
        <WorkspaceDetail
          key={selection.id}
          selection={selection}
          onOpen={() => onOpenWorkspace?.(selection.id)}
        />
      ) : null}
      {selection.type === "item" ? (
        <ItemDetail selection={selection} onApplyFix={onApplyFix} />
      ) : null}
      {selection.type === "member" ? (
        <MemberDetail
          key={selection.member.id}
          member={selection.member}
          activeIn={selection.activeIn}
        />
      ) : null}
      {selection.type === "attention" ? (
        <AttentionDetail
          item={selection.item}
          onOpen={() => onOpenDepartment?.(selection.item.departmentId)}
        />
      ) : null}
    </FloatingPanel>
  );
}

function CampaignPulse() {
  return (
    <div className="fade-up space-y-5">
      <div>
        <h2 className="text-[20px] font-medium leading-tight tracking-[-0.03em] text-ink">
          SecureEdge
        </h2>
        <p className="mt-1 text-[13px] text-ink-secondary">
          Full campaign graph · departments as rooms
        </p>
      </div>

      <p className="text-[13px] leading-relaxed text-ink-secondary">
        Double-click a department to enter its workspace. Teammates work inside those rooms — they
        are not separate steps on the graph.
      </p>

      <ul className="space-y-2">
        {departments.map((d) => (
          <li
            key={d.id}
            className="flex items-center justify-between rounded-[8px] border border-border px-3 py-2"
          >
            <span className="text-[13px] text-ink">{d.name}</span>
            <StatusBadge tone={d.tone}>
              {d.status === "complete"
                ? "Done"
                : d.status === "blocked"
                  ? "Blocked"
                  : d.status === "in_review"
                    ? "Review"
                    : "Active"}
            </StatusBadge>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DepartmentPulse({ id }: { id: DepartmentId }) {
  const dept = getDepartment(id);
  const team = membersForDepartment(id);

  return (
    <div className="fade-up space-y-4">
      <div>
        <StatusBadge tone={dept.tone}>{dept.name}</StatusBadge>
        <h2 className="mt-2 text-[16px] font-medium tracking-[-0.02em] text-ink">
          Department workspace
        </h2>
        <p className="mt-1 text-[13px] text-ink-secondary">{dept.summary}</p>
      </div>

      {dept.attention ? (
        <div className="rounded-[8px] border border-pale-yellow-ink/20 bg-pale-yellow px-3 py-2.5 text-[13px] text-pale-yellow-ink">
          {dept.attention}
        </div>
      ) : null}

      <section>
        <div className="mb-2 flex items-center gap-1.5 text-ink-tertiary">
          <Users size={13} weight="bold" />
          <span className="text-[11px] font-medium uppercase tracking-[0.05em]">Working here</span>
        </div>
        <ul className="space-y-2">
          {team.map((m) => (
            <MemberRow key={m.id} member={m} />
          ))}
        </ul>
      </section>

      {dept.branches?.length ? (
        <section>
          <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.05em] text-ink-tertiary">
            Lanes
          </p>
          <ul className="space-y-2">
            {dept.branches.map((b) => (
              <li
                key={b.id}
                className="flex items-center justify-between border-b border-border py-2"
              >
                <span className="text-[13px] text-ink">{b.name}</span>
                <StatusBadge tone={b.tone}>{b.status.replace("_", " ")}</StatusBadge>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function DepartmentDetail({ id, onOpen }: { id: DepartmentId; onOpen: () => void }) {
  const dept = getDepartment(id);
  const team = membersForDepartment(id);

  return (
    <div className="fade-up space-y-4">
      <div>
        <StatusBadge tone={dept.tone}>Department</StatusBadge>
        <h2 className="mt-2 text-[18px] font-medium tracking-[-0.02em] text-ink">{dept.name}</h2>
        <p className="mt-1 text-[13px] leading-relaxed text-ink-secondary">{dept.summary}</p>
      </div>

      {dept.attention ? (
        <div className="rounded-[8px] bg-pale-yellow px-3 py-2.5 text-[13px] text-pale-yellow-ink">
          {dept.attention}
        </div>
      ) : null}

      <section>
        <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.05em] text-ink-tertiary">
          Team in this room
        </p>
        <ul className="space-y-2">
          {team.map((m) => (
            <MemberRow key={m.id} member={m} />
          ))}
        </ul>
      </section>

      <Button onClick={onOpen}>
        Enter workspace
        <ArrowRight size={14} weight="bold" />
      </Button>
    </div>
  );
}

function ItemDetail({
  selection,
  onApplyFix,
}: {
  selection: Extract<InspectorSelection, { type: "item" }>;
  onApplyFix?: () => void;
}) {
  const isClaimIssue =
    selection.id === "co-claim" ||
    selection.id === "cr-blocker" ||
    selection.id === "cr-li3" ||
    selection.kind === "blocker";

  if (isClaimIssue && selection.departmentId === "compliance") {
    return (
      <div className="fade-up space-y-4">
        <div>
          <StatusBadge tone="danger">{issueDetail.severity}</StatusBadge>
          <h2 className="mt-2 text-[16px] font-medium tracking-[-0.02em] text-ink">
            {issueDetail.title}
          </h2>
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
          <Button variant="ghost">Ask Sarah to review</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fade-up space-y-3">
      <StatusBadge tone={selection.kind === "blocker" ? "danger" : "neutral"}>
        {selection.kind}
      </StatusBadge>
      <h2 className="text-[16px] font-medium text-ink">{selection.title}</h2>
      {selection.subtitle ? (
        <p className="text-[13px] leading-relaxed text-ink-secondary">{selection.subtitle}</p>
      ) : null}
      <p className="text-[12px] text-ink-tertiary">
        Part of this department’s board. Anyone on the team can leave comments, notes, and
        instructions here.
      </p>
    </div>
  );
}

export function MemberDetail({ member, activeIn }: { member: Member; activeIn?: string[] }) {
  const places = activeIn ?? member.departmentIds.map((id) => getDepartment(id).name);
  return (
    <div className="fade-up space-y-4">
      <div className="flex items-center gap-3">
        <span className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-canvas text-[12px] font-medium text-ink">
          {member.image ? (
            // oxlint-disable-next-line next/no-img-element
            <img src={member.image} alt="" className="h-full w-full object-cover" />
          ) : (
            member.initials
          )}
        </span>
        <div>
          <h2 className="text-[16px] font-medium text-ink">{member.name}</h2>
          <p className="flex items-center gap-1.5 text-[12px] text-ink-secondary">
            <StatusDot status={member.status} />
            {member.role}
          </p>
        </div>
      </div>

      <p className="text-[13px] leading-relaxed text-ink-secondary">
        {member.kind === "agent"
          ? "Lives in every workspace of this project — reads the canvas, keeps project memory, and answers when tagged with @Lyzy."
          : "Works the same rooms as everyone else — drafts, checks, comments, and handoffs."}
      </p>

      {places.length > 0 ? (
        <div>
          <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.05em] text-ink-tertiary">
            Active in
          </p>
          <ul className="stagger space-y-1">
            {places.map((name) => (
              <li key={name} className="text-[13px] text-ink">
                {name}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function WorkspaceDetail({
  selection,
  onOpen,
}: {
  selection: Extract<InspectorSelection, { type: "workspace" }>;
  onOpen: () => void;
}) {
  const complete = selection.status === "complete";
  return (
    <div className="fade-up space-y-4">
      <div>
        <StatusBadge tone={complete ? "ok" : "info"}>
          {complete ? "Complete" : "In progress"}
        </StatusBadge>
        <h2 className="mt-2 text-[18px] font-medium tracking-[-0.02em] text-ink">
          {selection.name}
        </h2>
        <p className="mt-1 text-[13px] leading-relaxed text-ink-secondary">{selection.summary}</p>
      </div>

      <section>
        <div className="mb-2 flex items-center gap-1.5 text-ink-tertiary">
          <Users size={13} weight="bold" />
          <span className="text-[11px] font-medium uppercase tracking-[0.05em]">
            Team in this room
          </span>
        </div>
        <ul className="stagger space-y-2">
          {selection.members.map((m) => (
            <MemberRow key={m.id} member={m} />
          ))}
        </ul>
      </section>

      <Button onClick={onOpen}>
        Enter workspace
        <ArrowRight size={14} weight="bold" />
      </Button>
    </div>
  );
}

function AttentionDetail({
  item,
  onOpen,
}: {
  item: Extract<InspectorSelection, { type: "attention" }>["item"];
  onOpen: () => void;
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
        <p className="mt-2 text-[12px] text-ink-tertiary">
          Department · {getDepartment(item.departmentId).name}
        </p>
      </div>
      <Button onClick={onOpen}>
        Open department
        <ArrowRight size={14} weight="bold" />
      </Button>
    </div>
  );
}

function MemberRow({ member }: { member: Member }) {
  return (
    <li className="flex items-center justify-between gap-2 rounded-[8px] border border-border px-3 py-2">
      <div className="flex items-center gap-2 min-w-0">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-canvas text-[9px] font-medium text-ink">
          {member.initials}
        </span>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium text-ink">{member.name}</p>
          <p className="truncate text-[11px] text-ink-tertiary">{member.role}</p>
        </div>
      </div>
      <StatusDot status={member.status} />
    </li>
  );
}

function StatusDot({ status }: { status: Member["status"] }) {
  return (
    <span
      title={status}
      className={clsx(
        "h-1.5 w-1.5 shrink-0 rounded-full",
        status === "working"
          ? "bg-pale-green-ink"
          : status === "online"
            ? "bg-ink-tertiary"
            : "bg-border-strong",
      )}
    />
  );
}
