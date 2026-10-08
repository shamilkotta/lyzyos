"use client";

import { useMemo, useState } from "react";
import { Check, SpinnerGap } from "@phosphor-icons/react";
import clsx from "clsx";
import { AGENT_ROLE } from "@lyzyos/db";
import { FloatingPanel } from "@/components/os/FloatingPanel";
import { Button } from "@/components/ui/Button";
import type { DirectoryUser } from "@/lib/api";
import { useDirectory } from "@/lib/queries/projects";

type Props = {
  title?: string;
  alreadyLabel?: string;
  emptyAvailableLabel?: string;
  memberIds: ReadonlySet<string>;
  onClose: () => void;
  onSubmit: (userIds: string[]) => Promise<void>;
};

function initials(name: string) {
  return (
    name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?"
  );
}

export function AddMembersPanel({
  title = "Add members",
  alreadyLabel = "Already added",
  emptyAvailableLabel = "Everyone is already added",
  memberIds,
  onClose,
  onSubmit,
}: Props) {
  const { data, isLoading, error } = useDirectory();
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [collapsed, setCollapsed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const people = useMemo(() => {
    const users = data?.users ?? [];
    return users
      .filter((u) => u.role !== AGENT_ROLE)
      .slice()
      .sort((a, b) => {
        const aIn = memberIds.has(a.id) ? 1 : 0;
        const bIn = memberIds.has(b.id) ? 1 : 0;
        if (aIn !== bIn) return aIn - bIn;
        return a.name.localeCompare(b.name);
      });
  }, [data?.users, memberIds]);

  const selectableCount = people.filter((p) => !memberIds.has(p.id)).length;
  const selectedCount = selected.size;

  const toggle = (user: DirectoryUser) => {
    if (memberIds.has(user.id)) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(user.id)) next.delete(user.id);
      else next.add(user.id);
      return next;
    });
    setNotice(null);
  };

  const submit = async () => {
    if (selected.size === 0 || submitting) return;
    setSubmitting(true);
    setNotice(null);
    try {
      await onSubmit([...selected]);
      setSelected(new Set());
      onClose();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Could not add members.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      <FloatingPanel
        title={title}
        subtitle={selectableCount === 0 ? emptyAvailableLabel : `${selectableCount} available`}
        collapsed={collapsed}
        onCollapsedChange={setCollapsed}
        onClose={onClose}
        footer={
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] text-ink-tertiary">
              {selectedCount === 0 ? "Select people to add" : `${selectedCount} selected`}
            </p>
            <Button
              onClick={() => void submit()}
              disabled={selectedCount === 0 || submitting}
              className="shrink-0"
            >
              {submitting ? (
                <>
                  <SpinnerGap size={14} className="animate-spin" />
                  Adding…
                </>
              ) : (
                `Add${selectedCount > 0 ? ` ${selectedCount}` : ""}`
              )}
            </Button>
          </div>
        }
      >
        {isLoading ? (
          <div className="flex items-center gap-2 text-[13px] text-ink-tertiary">
            <SpinnerGap size={14} className="animate-spin" />
            Loading people…
          </div>
        ) : error ? (
          <p className="text-[13px] text-ink-secondary">Could not load the directory.</p>
        ) : people.length === 0 ? (
          <p className="text-[13px] text-ink-secondary">No people in the directory yet.</p>
        ) : (
          <ul className="-mx-1 space-y-0.5">
            {people.map((person) => {
              const already = memberIds.has(person.id);
              const isSelected = selected.has(person.id);
              return (
                <li key={person.id}>
                  <button
                    type="button"
                    disabled={already}
                    onClick={() => toggle(person)}
                    className={clsx(
                      "flex w-full items-center gap-2.5 rounded-[8px] px-2 py-2 text-left transition-colors",
                      already
                        ? "cursor-default opacity-60"
                        : isSelected
                          ? "bg-surface-soft"
                          : "hover:bg-surface-soft/70",
                    )}
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-canvas text-[10px] font-medium text-ink">
                      {person.image ? (
                        // oxlint-disable-next-line next/no-img-element
                        <img src={person.image} alt="" className="h-full w-full object-cover" />
                      ) : (
                        initials(person.name)
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-ink">
                        {person.name}
                      </span>
                      <span className="block truncate text-[11px] text-ink-secondary">
                        {already ? alreadyLabel : person.email}
                      </span>
                    </span>
                    <span
                      className={clsx(
                        "flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] border",
                        already || isSelected
                          ? "border-ink bg-ink text-white"
                          : "border-border bg-surface text-transparent",
                      )}
                      aria-hidden
                    >
                      {(already || isSelected) && <Check size={11} weight="bold" />}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {notice ? <p className="mt-3 text-[12px] text-ink-secondary">{notice}</p> : null}
      </FloatingPanel>
    </div>
  );
}
