"use client";

import { useState } from "react";
import { ArrowRightIcon, UsersIcon } from "@phosphor-icons/react";
import clsx from "clsx";
import { MemberAvatar } from "@/components/canvas/nodes/CanvasNodes";
import { FloatingPanel } from "@/components/os/FloatingPanel";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { workStatusLabel, workStatusTone } from "@/lib/status";
import type { Member } from "@/lib/types";
import type { OverviewWorkspace } from "./ProjectOverviewCanvas";

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

type Props = {
  workspace: OverviewWorkspace;
  projectName: string;
  onOpen: () => void;
  onClose: () => void;
};

export function WorkspaceInspector({ workspace, projectName, onOpen, onClose }: Props) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      <FloatingPanel
        title="Workspace"
        subtitle="Details"
        collapsed={collapsed}
        onCollapsedChange={setCollapsed}
        onClose={onClose}
      >
        <div className="fade-up space-y-4">
          <div>
            <StatusBadge tone={workStatusTone(workspace.status)}>
              {workStatusLabel(workspace.status)}
            </StatusBadge>
            <h2 className="mt-2 text-[18px] font-medium tracking-[-0.02em] text-ink">
              {workspace.name}
            </h2>
            <p className="mt-1 text-[13px] leading-relaxed text-ink-secondary">
              {workspace.statusNote ?? `${projectName} · open to collaborate with Lyzy`}
            </p>
          </div>

          {workspace.attention ? (
            <div className="rounded-[8px] bg-pale-yellow px-3 py-2.5 text-[13px] text-pale-yellow-ink">
              {workspace.attention}
            </div>
          ) : null}

          <section>
            <div className="mb-2 flex items-center gap-1.5 text-ink-tertiary">
              <UsersIcon size={13} weight="bold" />
              <span className="text-[11px] font-medium uppercase tracking-[0.05em]">
                Team in this room
              </span>
            </div>
            <ul className="stagger space-y-2">
              {workspace.members.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center justify-between gap-2 rounded-[8px] border border-border px-3 py-2"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <MemberAvatar member={m} size="md" />
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium text-ink">{m.name}</p>
                      <p className="truncate text-[11px] text-ink-tertiary">{m.role}</p>
                    </div>
                  </div>
                  <StatusDot status={m.status} />
                </li>
              ))}
            </ul>
          </section>

          <Button onClick={onOpen}>
            Enter workspace
            <ArrowRightIcon size={14} weight="bold" />
          </Button>
        </div>
      </FloatingPanel>
    </div>
  );
}
