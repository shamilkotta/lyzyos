"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { CaretDown, CaretUp, X } from "@phosphor-icons/react";
import clsx from "clsx";

type Props = {
  title: string;
  subtitle?: string;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  onClose?: () => void;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  /** When this value changes, the body scrolls to the bottom (e.g. a new message arrived). */
  scrollToBottomKey?: string;
};

export function FloatingPanel({
  title,
  subtitle,
  collapsed,
  onCollapsedChange,
  onClose,
  children,
  footer,
  className,
  scrollToBottomKey,
}: Props) {
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollToBottomKey === undefined || collapsed) return;
    const body = bodyRef.current;
    if (body) body.scrollTo({ top: body.scrollHeight, behavior: "smooth" });
  }, [scrollToBottomKey, collapsed]);

  return (
    <aside
      className={clsx(
        "pointer-events-auto absolute right-4 z-30 flex w-[min(340px,calc(100%-2rem))] flex-col overflow-hidden rounded-[12px] border border-border bg-surface/95 shadow-[0_8px_28px_rgba(0,0,0,0.08)] backdrop-blur-md transition-[max-height,box-shadow] duration-200",
        collapsed ? "h-auto" : "bottom-4 max-h-[calc(100%-2rem)]",
        !/\btop-/.test(className ?? "") && "top-4",
        className,
      )}
    >
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2.5">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12px] font-medium text-ink">{title}</p>
          {!collapsed && subtitle ? (
            <p className="mt-0.5 truncate text-[11px] text-ink-secondary">{subtitle}</p>
          ) : null}
        </div>
        <button
          type="button"
          aria-label={collapsed ? "Expand panel" : "Collapse panel"}
          aria-expanded={!collapsed}
          onClick={() => onCollapsedChange(!collapsed)}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[6px] text-ink-tertiary hover:bg-surface-soft hover:text-ink"
        >
          {collapsed ? <CaretDown size={14} weight="bold" /> : <CaretUp size={14} weight="bold" />}
        </button>
        {onClose ? (
          <button
            type="button"
            aria-label="Close panel"
            onClick={onClose}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[6px] text-ink-tertiary hover:bg-surface-soft hover:text-ink"
          >
            <X size={14} weight="bold" />
          </button>
        ) : null}
      </div>

      {!collapsed ? (
        <>
          <div ref={bodyRef} className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
            {children}
          </div>
          {footer ? (
            <div className="shrink-0 border-t border-border bg-surface/95 px-3 py-3">{footer}</div>
          ) : null}
        </>
      ) : null}
    </aside>
  );
}
