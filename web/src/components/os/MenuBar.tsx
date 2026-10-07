"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MagnifyingGlass, Bell, CirclesFour, CaretRight, SignOut } from "@phosphor-icons/react";
import { PRODUCT_NAME } from "@/lib/data";
import { signOut } from "@/lib/auth-client";
import { routes } from "@/lib/routes";
import { useCurrentUser } from "@/lib/session";
import clsx from "clsx";

type Props = {
  spaceName?: string;
  departmentName?: string;
  onCommand: () => void;
  onToggleAttention: () => void;
  attentionCount: number;
  view: "home" | "campaign" | "workspace";
  onHome: () => void;
  onBackToOverview?: () => void;
  workspaceName?: string;
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

export function MenuBar({
  spaceName,
  departmentName,
  onCommand,
  onToggleAttention,
  attentionCount,
  view,
  onHome,
  onBackToOverview,
  workspaceName,
}: Props) {
  const router = useRouter();
  const { user } = useCurrentUser();
  const [menuOpen, setMenuOpen] = useState(false);
  const inProject = (view === "campaign" || view === "workspace") && Boolean(spaceName);

  async function handleSignOut() {
    await signOut();
    router.push(routes.login);
    router.refresh();
  }

  return (
    <header className="relative z-20 flex h-[var(--menubar-h)] shrink-0 items-center justify-between border-b border-border bg-surface/90 px-3 backdrop-blur-md">
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          onClick={onHome}
          className="flex items-center gap-2 rounded-[6px] px-1.5 py-1 transition-colors hover:bg-surface-soft"
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-[5px] bg-ink text-white">
            <CirclesFour size={13} weight="bold" />
          </span>
          <span className="font-brand text-[14px] font-semibold tracking-[-0.03em] text-ink">
            {PRODUCT_NAME}
          </span>
        </button>

        {inProject ? (
          <>
            <CaretRight size={12} className="shrink-0 text-ink-tertiary" />
            <button
              type="button"
              onClick={onBackToOverview}
              className={clsx(
                "truncate text-[13px]",
                departmentName || view === "workspace"
                  ? "text-ink-secondary hover:text-ink"
                  : "cursor-default text-ink",
              )}
              disabled={!departmentName && view !== "workspace"}
            >
              {spaceName}
            </button>
          </>
        ) : null}

        {view === "campaign" && departmentName ? (
          <>
            <CaretRight size={12} className="shrink-0 text-ink-tertiary" />
            <span className="truncate text-[13px] text-ink">{departmentName}</span>
          </>
        ) : null}

        {view === "workspace" ? (
          <>
            <CaretRight size={12} className="shrink-0 text-ink-tertiary" />
            <span className="truncate text-[13px] text-ink">{workspaceName || "Workspace"}</span>
          </>
        ) : null}
      </div>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={onCommand}
          className={clsx(
            "flex h-8 items-center gap-2 rounded-[6px] border border-border bg-canvas px-2.5 text-[12px] text-ink-secondary transition-colors hover:border-border-strong hover:text-ink",
          )}
        >
          <MagnifyingGlass size={14} weight="bold" />
          <span className="hidden sm:inline">Search or run</span>
          <kbd>⌘K</kbd>
        </button>

        <button
          type="button"
          onClick={onToggleAttention}
          className="relative flex h-8 w-8 items-center justify-center rounded-[6px] text-ink-secondary transition-colors hover:bg-surface-soft hover:text-ink"
          aria-label="Needs attention"
        >
          <Bell size={16} weight="bold" />
          {attentionCount > 0 ? (
            <span className="absolute right-1 top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-pale-red-ink px-1 text-[9px] font-medium text-white">
              {attentionCount}
            </span>
          ) : null}
        </button>

        <div className="relative ml-1">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-canvas text-[11px] font-medium text-ink transition-colors hover:bg-surface-soft"
            aria-label="Account menu"
          >
            {user ? initials(user.name) : "··"}
          </button>
          {menuOpen ? (
            <div className="absolute right-0 top-[calc(100%+6px)] z-30 min-w-[180px] rounded-[8px] border border-border bg-surface p-1.5 shadow-[var(--shadow-soft)]">
              {user ? (
                <div className="border-b border-border px-2.5 py-2">
                  <p className="truncate text-[12px] font-medium text-ink">{user.name}</p>
                  <p className="truncate text-[11px] text-ink-tertiary">{user.email}</p>
                </div>
              ) : null}
              <button
                type="button"
                onClick={handleSignOut}
                className="mt-1 flex w-full items-center gap-2 rounded-[6px] px-2.5 py-1.5 text-left text-[12px] text-ink-secondary transition-colors hover:bg-surface-soft hover:text-ink"
              >
                <SignOut size={14} weight="bold" />
                Sign out
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
