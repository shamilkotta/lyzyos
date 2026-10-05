"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowsOut, X } from "@phosphor-icons/react";
import clsx from "clsx";

export type DocMediaKind = "image" | "pdf" | "file";

type Props = {
  url: string;
  kind: DocMediaKind;
  mime?: string;
  title?: string;
  /** Compact canvas card vs taller sidebar. */
  size?: "card" | "panel";
  className?: string;
};

function PreviewBody({
  url,
  kind,
  mime,
  size,
}: {
  url: string;
  kind: DocMediaKind;
  mime?: string;
  size: "card" | "panel" | "modal";
}) {
  if (kind === "image") {
    return (
      // Dynamic API file URLs — next/image isn't a fit here.
      // oxlint-disable-next-line next/no-img-element
      <img
        src={url}
        alt=""
        className={clsx(
          "w-full object-contain",
          size === "card" && "h-28",
          size === "panel" && "max-h-56",
          size === "modal" && "max-h-[min(80vh,900px)]",
        )}
        draggable={false}
      />
    );
  }

  if (kind === "pdf") {
    return (
      <iframe
        src={url}
        title="PDF preview"
        className={clsx(
          "w-full border-0 bg-canvas",
          size === "card" && "h-36",
          size === "panel" && "h-64",
          size === "modal" && "h-[min(80vh,900px)]",
        )}
      />
    );
  }

  return (
    <div
      className={clsx(
        "flex items-center justify-center text-[11px] text-ink-tertiary",
        size === "card" && "h-16",
        size === "panel" && "h-32",
        size === "modal" && "h-48",
      )}
    >
      {mime?.split("/")[1]?.toUpperCase() || "FILE"}
    </div>
  );
}

export function DocMediaPreview({ url, kind, mime, title, size = "card", className }: Props) {
  const [open, setOpen] = useState(false);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <div
        className={clsx(
          "relative overflow-hidden rounded-[6px] border border-border bg-canvas",
          className,
        )}
      >
        <PreviewBody url={url} kind={kind} mime={mime} size={size} />
        <button
          type="button"
          title="View fullscreen"
          aria-label="View fullscreen"
          className="nodrag nopan absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-[4px] bg-surface/40 text-ink-tertiary opacity-70 transition-all hover:bg-surface/70 hover:text-ink hover:opacity-100"
          onClick={(e) => {
            e.stopPropagation();
            setOpen(true);
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <ArrowsOut size={11} weight="bold" />
        </button>
      </div>

      {typeof document !== "undefined" && open
        ? createPortal(
            <div
              className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/50 p-4 backdrop-blur-[2px]"
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              onClick={() => setOpen(false)}
            >
              <div
                className="relative flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-[12px] border border-border bg-surface shadow-lg"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
                  <h2
                    id={titleId}
                    className="truncate text-[14px] font-medium tracking-[-0.02em] text-ink"
                  >
                    {title?.trim() || "Document"}
                  </h2>
                  <button
                    type="button"
                    aria-label="Close"
                    className="flex h-8 w-8 items-center justify-center rounded-[6px] text-ink-secondary hover:bg-surface-soft hover:text-ink"
                    onClick={() => setOpen(false)}
                  >
                    <X size={16} weight="bold" />
                  </button>
                </div>
                <div className="min-h-0 flex-1 overflow-auto bg-canvas p-2">
                  <PreviewBody url={url} kind={kind} mime={mime} size="modal" />
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

export function mediaKindFromPreview(kind: string | undefined, mime?: string): DocMediaKind {
  if (kind === "image") return "image";
  if (kind === "pdf") return "pdf";
  const m = (mime ?? "").toLowerCase();
  if (m === "application/pdf") return "pdf";
  if (m.startsWith("image/")) return "image";
  return "file";
}
