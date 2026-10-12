"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CaretRightIcon,
  CirclesFourIcon,
  MagnifyingGlassIcon,
  SignOutIcon,
} from "@phosphor-icons/react";
import { signOut } from "@/lib/auth-client";
import { PRODUCT_NAME } from "@/lib/constants";
import { initials } from "@/lib/format";
import { routes } from "@/lib/routes";
import { useCurrentUser } from "@/lib/session";

type Props = {
  projectName?: string;
  workspaceName?: string;
  onBackToProject?: () => void;
  onHome: () => void;
  onCommand: () => void;
};

function AccountMenu() {
  const router = useRouter();
  const { user } = useCurrentUser();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
      }
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [open]);

  async function handleSignOut() {
    await signOut();
    router.push(routes.login);
    router.refresh();
  }

  return (
    <div ref={rootRef} className="relative ml-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-7 w-7 items-center justify-center rounded-full bg-canvas text-[11px] font-medium text-ink transition-colors hover:bg-surface-soft"
        aria-label="Account menu"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {user ? initials(user.name) : "··"}
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+6px)] z-30 min-w-[180px] rounded-[8px] border border-border bg-surface p-1.5 shadow-[var(--shadow-soft)]"
        >
          {user ? (
            <div className="border-b border-border px-2.5 py-2">
              <p className="truncate text-[12px] font-medium text-ink">{user.name}</p>
              <p className="truncate text-[11px] text-ink-tertiary">{user.email}</p>
            </div>
          ) : null}
          <button
            type="button"
            role="menuitem"
            onClick={handleSignOut}
            className="mt-1 flex w-full items-center gap-2 rounded-[6px] px-2.5 py-1.5 text-left text-[12px] text-ink-secondary transition-colors hover:bg-surface-soft hover:text-ink"
          >
            <SignOutIcon size={14} weight="bold" />
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function MenuBar({ projectName, workspaceName, onBackToProject, onHome, onCommand }: Props) {
  const inWorkspace = workspaceName !== undefined;

  return (
    <header className="relative z-20 flex h-[var(--menubar-h)] shrink-0 items-center justify-between border-b border-border bg-surface/90 px-3 backdrop-blur-md">
      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          onClick={onHome}
          className="flex items-center gap-2 rounded-[6px] px-1.5 py-1 transition-colors hover:bg-surface-soft"
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-[5px] bg-ink text-white">
            <CirclesFourIcon size={13} weight="bold" />
          </span>
          <span className="font-brand text-[14px] font-semibold tracking-[-0.03em] text-ink">
            {PRODUCT_NAME}
          </span>
        </button>

        {projectName ? (
          <>
            <CaretRightIcon size={12} className="shrink-0 text-ink-tertiary" />
            {inWorkspace ? (
              <button
                type="button"
                onClick={onBackToProject}
                className="truncate text-[13px] text-ink-secondary hover:text-ink"
              >
                {projectName}
              </button>
            ) : (
              <span className="truncate text-[13px] text-ink" aria-current="page">
                {projectName}
              </span>
            )}
          </>
        ) : null}

        {inWorkspace ? (
          <>
            <CaretRightIcon size={12} className="shrink-0 text-ink-tertiary" />
            <span className="truncate text-[13px] text-ink" aria-current="page">
              {workspaceName || "Workspace"}
            </span>
          </>
        ) : null}
      </nav>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={onCommand}
          className="flex h-8 items-center gap-2 rounded-[6px] border border-border bg-canvas px-2.5 text-[12px] text-ink-secondary transition-colors hover:border-border-strong hover:text-ink"
        >
          <MagnifyingGlassIcon size={14} weight="bold" />
          <span className="hidden sm:inline">Search or run</span>
          <kbd>⌘K</kbd>
        </button>
        <AccountMenu />
      </div>
    </header>
  );
}
