"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import type { Member } from "@/lib/types";

type Props = {
  members: Member[];
  /** Optional workspace/room labels to show under the member. */
  activeInFor?: (member: Member) => string[] | undefined;
  /** Rendered after the avatar stack (e.g. add-member control). */
  trailing?: ReactNode;
};

type Point = { x: number; y: number };

function statusLabel(status: Member["status"]) {
  if (status === "working") return "Working";
  if (status === "away") return "Away";
  return "Online";
}

/** Offset so the card sits at the bottom-right of the pointer tip. */
const POINTER_GAP_X = 12;
const POINTER_GAP_Y = 12;
const CARD_WIDTH = 224; // w-56

function clampPoint(point: Point): Point {
  if (typeof window === "undefined") return point;
  const maxX = window.innerWidth - CARD_WIDTH - 8;
  const maxY = window.innerHeight - 160;
  return {
    x: Math.min(Math.max(8, point.x + POINTER_GAP_X), maxX),
    y: Math.min(Math.max(8, point.y + POINTER_GAP_Y), maxY),
  };
}

export function TeamPresence({ members, activeInFor, trailing }: Props) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const [point, setPoint] = useState<Point | null>(null);
  const [mounted, setMounted] = useState(false);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const activeId = pinnedId ?? hoveredId;
  const activeMember = members.find((m) => m.id === activeId) ?? null;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!pinnedId) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || cardRef.current?.contains(target)) return;
      setPinnedId(null);
      setHoveredId(null);
      setPoint(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPinnedId(null);
        setHoveredId(null);
        setPoint(null);
      }
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [pinnedId]);

  if (members.length === 0 && !trailing) return null;

  const clearLeaveTimer = () => {
    if (leaveTimer.current) {
      clearTimeout(leaveTimer.current);
      leaveTimer.current = null;
    }
  };

  const scheduleHoverClear = () => {
    clearLeaveTimer();
    leaveTimer.current = setTimeout(() => {
      if (!pinnedId) {
        setHoveredId(null);
        setPoint(null);
      }
    }, 120);
  };

  const placeAt = (clientX: number, clientY: number) => {
    setPoint(clampPoint({ x: clientX, y: clientY }));
  };

  const activeIn = activeMember ? activeInFor?.(activeMember) : undefined;
  const card =
    mounted && activeMember && point
      ? createPortal(
          <div
            ref={cardRef}
            role="tooltip"
            style={{ left: point.x, top: point.y }}
            className="pointer-events-auto fixed z-50 w-56 rounded-[10px] border border-border bg-surface p-3 text-left shadow-[0_8px_24px_rgba(0,0,0,0.1)] fade-up"
            onMouseEnter={clearLeaveTimer}
            onMouseLeave={scheduleHoverClear}
          >
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-canvas text-[11px] font-medium text-ink">
                {activeMember.image ? (
                  // oxlint-disable-next-line next/no-img-element
                  <img src={activeMember.image} alt="" className="h-full w-full object-cover" />
                ) : (
                  activeMember.initials
                )}
                <span
                  className={clsx(
                    "absolute bottom-0 right-0 h-2 w-2 rounded-full ring-2 ring-surface",
                    activeMember.status === "online" || activeMember.status === "working"
                      ? "bg-pale-green-ink"
                      : "bg-ink-tertiary",
                  )}
                />
              </span>
              <div className="min-w-0">
                <p className="truncate text-[13px] font-medium text-ink">{activeMember.name}</p>
                <p className="truncate text-[11px] text-ink-secondary">{activeMember.role}</p>
              </div>
            </div>
            <p className="mt-2 text-[11px] text-ink-tertiary">
              {statusLabel(activeMember.status)}
              {activeMember.kind === "agent" ? " · Agent" : null}
            </p>
            {activeIn && activeIn.length > 0 ? (
              <p className="mt-1.5 line-clamp-2 text-[11px] leading-snug text-ink-secondary">
                Active in {activeIn.join(", ")}
              </p>
            ) : null}
          </div>,
          document.body,
        )
      : null;

  return (
    <div ref={rootRef} className="pointer-events-auto flex items-center">
      {members.map((m, i) => {
        const open = activeId === m.id;
        return (
          <button
            key={m.id}
            type="button"
            aria-expanded={open}
            onMouseEnter={(event) => {
              clearLeaveTimer();
              if (!pinnedId) {
                setHoveredId(m.id);
                placeAt(event.clientX, event.clientY);
              }
            }}
            onMouseMove={(event) => {
              if (pinnedId) return;
              if (hoveredId === m.id) placeAt(event.clientX, event.clientY);
            }}
            onMouseLeave={scheduleHoverClear}
            onClick={(event) => {
              event.stopPropagation();
              placeAt(event.clientX, event.clientY);
              setPinnedId((current) => (current === m.id ? null : m.id));
              setHoveredId(m.id);
            }}
            className={clsx(
              "relative flex h-7 w-7 items-center justify-center overflow-hidden rounded-full border border-border/80 bg-surface text-[10px] font-medium text-ink shadow-sm transition-transform hover:z-10 hover:scale-105",
              i > 0 && "-ml-1.5",
              open && "z-10 ring-2 ring-ink/15",
            )}
          >
            {m.image ? (
              // oxlint-disable-next-line next/no-img-element
              <img src={m.image} alt="" className="h-full w-full object-cover" />
            ) : (
              m.initials
            )}
            <span
              className={clsx(
                "absolute bottom-0 right-0 h-1.5 w-1.5 rounded-full ring-2 ring-canvas",
                m.status === "online" || m.status === "working" ? "bg-ink" : "bg-ink-tertiary",
              )}
            />
          </button>
        );
      })}
      {trailing ? (
        <div className={clsx("relative z-[1]", members.length > 0 && "-ml-1.5")}>{trailing}</div>
      ) : null}
      {card}
    </div>
  );
}
