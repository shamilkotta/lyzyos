"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, Paperclip, FileText, X, SpinnerGap } from "@phosphor-icons/react";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { createProject } from "@/lib/api";
import { PROJECT_DOC_ACCEPT, filterAllowedProjectDocs } from "@/lib/docs";
import clsx from "clsx";

type Attachment = {
  id: string;
  name: string;
  sizeLabel: string;
  file: File;
};

type Props = {
  onCreated: (projectId: string, projectName: string) => void;
  focusToken?: number;
};

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function KickoffComposer({ onCreated, focusToken }: Props) {
  const [brief, setBrief] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [phase, setPhase] = useState<"compose" | "analyzing" | "ready">("compose");
  const [error, setError] = useState<string | null>(null);
  const [createdName, setCreatedName] = useState("");
  const [createdId, setCreatedId] = useState("");
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
    const allowed = filterAllowedProjectDocs(files);
    if (allowed.length === 0) {
      setError("Only images and PDFs are supported.");
      return;
    }
    if (allowed.length < Array.from(files).length) {
      setError("Some files were skipped — only images and PDFs are supported.");
    } else {
      setError(null);
    }
    const next = allowed.map((file) => ({
      id: `${file.name}-${file.size}-${file.lastModified}-${Math.random()}`,
      name: file.name,
      sizeLabel: formatSize(file.size),
      file,
    }));
    setAttachments((prev) => {
      const names = new Set(prev.map((p) => p.name));
      return [...prev, ...next.filter((f) => !names.has(f.name))];
    });
  };

  const canSubmit = brief.trim().length > 0 || attachments.length > 0;

  const submit = async () => {
    if (!canSubmit || phase !== "compose") return;
    setPhase("analyzing");
    setError(null);
    try {
      const result = await createProject({
        brief: brief.trim(),
        files: attachments.map((a) => a.file),
      });
      setCreatedId(result.projectId);
      setCreatedName(result.project?.name ?? "Untitled project");
      setPhase("ready");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start project.");
      setPhase("compose");
    }
  };

  const reset = () => {
    setPhase("compose");
    setBrief("");
    setAttachments([]);
    setError(null);
    setCreatedId("");
    setCreatedName("");
  };

  return (
    <div ref={rootRef} className="fade-up space-y-3">
      {error ? (
        <div className="rounded-[8px] border border-pale-red-ink/20 bg-pale-red px-3 py-2 text-[13px] text-pale-red-ink">
          {error}
        </div>
      ) : null}

      {phase === "analyzing" ? (
        <div className="rounded-[12px] border border-border bg-surface px-4 py-8 text-center">
          <SpinnerGap size={22} weight="bold" className="mx-auto animate-spin text-ink-tertiary" />
          <p className="mt-3 text-[14px] font-medium text-ink">Saving intake…</p>
          <p className="mt-1 text-[13px] text-ink-secondary">
            Storing brief and documents, then waking Lyzy for this project.
          </p>
        </div>
      ) : null}

      {phase === "ready" ? (
        <div className="rounded-[12px] border border-border bg-surface p-4">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <StatusBadge tone="info">Project created</StatusBadge>
              <h2 className="mt-2 text-[18px] font-medium tracking-[-0.02em] text-ink">
                {createdName}
              </h2>
              <p className="mt-1 text-[12px] text-ink-secondary">
                Lyzy is reading the brief in the background. Open the project graph, then enter
                Planning.
              </p>
            </div>
            <button
              type="button"
              onClick={reset}
              className="text-[12px] font-medium text-ink-secondary hover:text-ink"
            >
              New
            </button>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={reset}>
              Stay on home
            </Button>
            <Button onClick={() => onCreated(createdId, createdName)}>Open project</Button>
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
              Describe the work or drop briefs — each kickoff creates a new project and agent.
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
                  void submit();
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
                accept={PROJECT_DOC_ACCEPT}
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
                  Images or PDFs · ⌘↵ to send
                </span>
              )}
            </div>

            <button
              type="button"
              disabled={!canSubmit}
              onClick={() => void submit()}
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
