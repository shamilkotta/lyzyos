"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, Paperclip, FileText, X, SpinnerGap } from "@phosphor-icons/react";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import clsx from "clsx";

type Attachment = {
  id: string;
  name: string;
  sizeLabel: string;
};

type Props = {
  onCreated: () => void;
  focusToken?: number;
};

const extracted = [
  { label: "Objective", value: "Enterprise awareness + qualified pipeline" },
  { label: "Audience", value: "CTOs · CISOs · Security Directors" },
  { label: "Markets", value: "US · UK · Germany" },
  { label: "Channels", value: "LinkedIn · Google Ads · Email · Landing page" },
  { label: "Launch", value: "November 10" },
];

const missing = [
  "Approved product claims",
  "Pricing / CTA destination",
  "Germany legal disclaimer",
];

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function KickoffComposer({ onCreated, focusToken }: Props) {
  const [brief, setBrief] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [phase, setPhase] = useState<"compose" | "analyzing" | "review">("compose");
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (focusToken == null) return;
    rootRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    textareaRef.current?.focus();
  }, [focusToken]);

  const addFiles = (files: FileList | File[]) => {
    const next = Array.from(files).map((file) => ({
      id: `${file.name}-${file.size}-${file.lastModified}-${Math.random()}`,
      name: file.name,
      sizeLabel: formatSize(file.size),
    }));
    setAttachments((prev) => {
      const names = new Set(prev.map((p) => p.name));
      return [...prev, ...next.filter((f) => !names.has(f.name))];
    });
  };

  const canSubmit = brief.trim().length > 0 || attachments.length > 0;

  const submit = () => {
    if (!canSubmit || phase !== "compose") return;
    setPhase("analyzing");
    window.setTimeout(() => setPhase("review"), 1100);
  };

  const reset = () => {
    setPhase("compose");
    setBrief("");
    setAttachments([]);
  };

  return (
    <div ref={rootRef} className="fade-up space-y-3">
      {phase === "analyzing" ? (
        <div className="rounded-[12px] border border-border bg-surface px-4 py-8 text-center">
          <SpinnerGap size={22} weight="bold" className="mx-auto animate-spin text-ink-tertiary" />
          <p className="mt-3 text-[14px] font-medium text-ink">Reading the brief…</p>
          <p className="mt-1 text-[13px] text-ink-secondary">
            Campaign Manager is extracting objectives, audiences, markets, and gaps
            {attachments.length > 0
              ? ` from your note and ${attachments.length} document${attachments.length > 1 ? "s" : ""}`
              : ""}
            .
          </p>
        </div>
      ) : null}

      {phase === "review" ? (
        <div className="rounded-[12px] border border-border bg-surface p-4">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <StatusBadge tone="info">Structured</StatusBadge>
              <h2 className="mt-2 text-[18px] font-medium tracking-[-0.02em] text-ink">
                SecureEdge Enterprise Launch
              </h2>
              <p className="mt-1 text-[12px] text-ink-secondary">
                Campaign Manager drafted the intake graph. Confirm gaps before opening the space.
              </p>
            </div>
            <button
              type="button"
              onClick={reset}
              className="text-[12px] font-medium text-ink-secondary hover:text-ink"
            >
              Edit
            </button>
          </div>

          {attachments.length > 0 ? (
            <div className="mb-4 flex flex-wrap gap-1.5">
              {attachments.map((file) => (
                <span
                  key={file.id}
                  className="inline-flex items-center gap-1.5 rounded-[6px] border border-border bg-canvas px-2 py-1 text-[11px] text-ink-secondary"
                >
                  <FileText size={12} weight="bold" />
                  {file.name}
                </span>
              ))}
            </div>
          ) : null}

          <dl className="grid gap-2 sm:grid-cols-2">
            {extracted.map((row) => (
              <div key={row.label} className="rounded-[8px] border border-border px-3 py-2.5">
                <dt className="text-[11px] font-medium uppercase tracking-[0.05em] text-ink-tertiary">
                  {row.label}
                </dt>
                <dd className="mt-1 text-[13px] text-ink">{row.value}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-4 rounded-[8px] border border-pale-yellow-ink/20 bg-pale-yellow px-3 py-3">
            <p className="text-[11px] font-medium uppercase tracking-[0.05em] text-pale-yellow-ink">
              Needs your input
            </p>
            <ul className="mt-2 space-y-1.5">
              {missing.map((item) => (
                <li key={item} className="text-[13px] text-ink">
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" onClick={reset}>
              Keep editing
            </Button>
            <Button
              onClick={() => {
                reset();
                onCreated();
              }}
            >
              Open workspace
            </Button>
          </div>
        </div>
      ) : null}

      {phase === "compose" ? (
        <div
          className={clsx(
            "rounded-[12px] border bg-surface transition-[border-color,box-shadow] duration-200",
            dragging ? "border-ink shadow-[0_2px_8px_rgba(0,0,0,0.04)]" : "border-border",
          )}
          onDragEnter={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setDragging(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
          }}
        >
          <div className="border-b border-border px-3 py-2.5">
            <p className="text-[12px] font-medium text-ink">Kick off with the team</p>
            <p className="text-[12px] text-ink-secondary">
              Describe the work or drop briefs — Campaign Manager will structure intake.
            </p>
          </div>

          <div className="px-3 pt-3">
            <textarea
              ref={textareaRef}
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              rows={3}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  submit();
                }
              }}
              placeholder="Launch SecureEdge across US, UK and Germany for enterprise CTOs…"
              className="w-full resize-none bg-transparent text-[14px] leading-relaxed text-ink outline-none placeholder:text-ink-tertiary"
            />

            {attachments.length > 0 ? (
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {attachments.map((file) => (
                  <li
                    key={file.id}
                    className="inline-flex max-w-full items-center gap-1.5 rounded-[6px] border border-border bg-canvas py-1 pl-2 pr-1 text-[12px] text-ink"
                  >
                    <FileText size={13} weight="bold" className="shrink-0 text-ink-tertiary" />
                    <span className="truncate">{file.name}</span>
                    <span className="shrink-0 font-mono text-[10px] text-ink-tertiary">
                      {file.sizeLabel}
                    </span>
                    <button
                      type="button"
                      aria-label={`Remove ${file.name}`}
                      onClick={() => setAttachments((prev) => prev.filter((a) => a.id !== file.id))}
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[4px] text-ink-tertiary hover:bg-surface-soft hover:text-ink"
                    >
                      <X size={11} weight="bold" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className="flex items-center justify-between gap-2 px-2 py-2">
            <div className="flex items-center gap-1">
              <input
                ref={fileRef}
                type="file"
                multiple
                className="hidden"
                accept=".pdf,.doc,.docx,.txt,.md,.png,.jpg,.jpeg,.ppt,.pptx"
                onChange={(e) => {
                  if (e.target.files?.length) addFiles(e.target.files);
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex h-8 items-center gap-1.5 rounded-[6px] px-2 text-[12px] text-ink-secondary transition-colors hover:bg-surface-soft hover:text-ink"
              >
                <Paperclip size={14} weight="bold" />
                Attach
              </button>
              {attachments.length > 0 ? (
                <span className="font-mono text-[11px] text-ink-tertiary">
                  {attachments.length} file{attachments.length > 1 ? "s" : ""}
                </span>
              ) : (
                <span className="hidden text-[11px] text-ink-tertiary sm:inline">
                  Drop docs here · ⌘↵ to send
                </span>
              )}
            </div>

            <button
              type="button"
              disabled={!canSubmit}
              onClick={submit}
              className={clsx(
                "flex h-8 items-center gap-1.5 rounded-[6px] px-3 text-[12px] font-medium transition-all duration-200 active:scale-[0.98]",
                canSubmit
                  ? "bg-ink text-white hover:bg-[#333333]"
                  : "cursor-not-allowed bg-surface-soft text-ink-tertiary",
              )}
            >
              Start
              <ArrowUp size={13} weight="bold" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
