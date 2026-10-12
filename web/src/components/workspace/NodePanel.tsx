"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowUpIcon,
  CheckIcon,
  FileTextIcon,
  PencilSimpleIcon,
  TrashIcon,
} from "@phosphor-icons/react";
import clsx from "clsx";
import { MemberAvatar, MemberStack } from "@/components/canvas/nodes/CanvasNodes";
import { DocMediaPreview, mediaKindFromPreview } from "@/components/docs/DocMediaPreview";
import { FloatingPanel } from "@/components/os/FloatingPanel";
import { Markdown, type MentionTarget } from "@/components/ui/Markdown";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useDebouncedCallback } from "@/lib/debounce";
import { toMember } from "@/lib/members";
import {
  documentFileUrl,
  isCommentNode,
  type BoardNode,
  type CommentNodeDto,
  type DocNodeDto,
} from "@/lib/project-types";
import { boardKindLabel, membersFor } from "./boardFlow";

const META_SAVE_MS = 550;

const fieldClass =
  "w-full rounded-[8px] border border-border bg-canvas px-3 py-2 text-ink outline-none focus:border-border-strong";

type SaveNode = (nodeId: string, input: { title: string; data?: string }) => Promise<boolean>;

function DocFile({
  projectId,
  node,
  title,
}: {
  projectId: string;
  node: DocNodeDto;
  title: string;
}) {
  if (!node.docId) {
    return (
      <div className="flex items-center gap-2 rounded-[8px] border border-border bg-canvas px-3 py-2 text-[12px] text-ink-secondary">
        <FileTextIcon size={14} weight="bold" />
        <span className="truncate">{title || "No file preview"}</span>
      </div>
    );
  }
  return (
    <DocMediaPreview
      url={documentFileUrl(projectId, node.docId)}
      kind={mediaKindFromPreview(node.previewKind, node.mime)}
      mime={node.mime}
      title={title}
      size="panel"
    />
  );
}

function NodeEditor({
  projectId,
  node,
  onSave,
}: {
  projectId: string;
  node: Extract<BoardNode, { kind: "note" | "doc" }>;
  onSave: SaveNode;
}) {
  const [draft, setDraft] = useState<{ title: string; body: string } | null>(null);
  const [editingBody, setEditingBody] = useState(false);
  const title = draft?.title ?? node.title;
  const body = draft?.body ?? node.body;
  const isNote = node.kind === "note";

  const latest = useRef({ node, draft, onSave });
  useEffect(() => {
    latest.current = { node, draft, onSave };
  });

  const persist = useCallback(async () => {
    const { node: current, draft: pending, onSave: saveNode } = latest.current;
    if (!pending) return;
    const title = pending.title.trim();
    const saved = await saveNode(current.id, {
      title: current.kind === "note" ? title || current.title : title,
      ...(current.kind === "note" ? { data: pending.body } : {}),
    });
    if (saved) setDraft((d) => (d === pending ? null : d));
  }, []);
  const save = useDebouncedCallback(persist, META_SAVE_MS);

  useEffect(() => {
    if (latest.current.draft) save.schedule();
  }, [node.id, save]);

  const edit = (patch: Partial<{ title: string; body: string }>) => {
    setDraft({ title, body, ...patch });
    save.schedule();
  };

  return (
    <>
      <input
        value={title}
        onChange={(e) => edit({ title: e.target.value })}
        onBlur={() => save.flush()}
        className={clsx(fieldClass, "text-[15px] font-medium tracking-[-0.02em]")}
        placeholder={isNote ? "Title" : "Add a title…"}
        aria-label="Title"
      />

      {node.kind === "doc" ? <DocFile projectId={projectId} node={node} title={title} /> : null}

      {isNote ? (
        <>
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-ink-tertiary">
              {editingBody ? "Markdown supported" : null}
            </span>
            <button
              type="button"
              onClick={() => {
                if (editingBody) save.flush();
                setEditingBody(!editingBody);
              }}
              className="flex h-7 items-center gap-1.5 rounded-[6px] px-2 text-[12px] text-ink-secondary transition-colors hover:bg-surface-soft hover:text-ink"
            >
              {editingBody ? (
                <CheckIcon size={13} weight="bold" />
              ) : (
                <PencilSimpleIcon size={13} weight="bold" />
              )}
              {editingBody ? "Done" : "Edit"}
            </button>
          </div>
          {editingBody ? (
            <textarea
              autoFocus
              value={body}
              onChange={(e) => edit({ body: e.target.value })}
              onBlur={() => save.flush()}
              placeholder="Constraints, context, decisions… (markdown supported)"
              aria-label="Note body"
              className={clsx(
                fieldClass,
                "min-h-[200px] flex-1 resize-none py-3 text-[13px] leading-relaxed",
              )}
            />
          ) : (
            <button
              type="button"
              onDoubleClick={() => setEditingBody(true)}
              onClick={() => {
                if (!body.trim()) setEditingBody(true);
              }}
              title="Double-click to edit"
              className="flex min-h-[200px] w-full flex-1 cursor-text flex-col justify-start rounded-[8px] border border-border bg-canvas px-3 py-3 text-left"
            >
              {body.trim() ? (
                <Markdown>{body}</Markdown>
              ) : (
                <span className="text-[13px] text-ink-tertiary">
                  Constraints, context, decisions… Click to write.
                </span>
              )}
            </button>
          )}
        </>
      ) : null}
    </>
  );
}

function ReadOnlyNode({ projectId, node }: { projectId: string; node: BoardNode }) {
  return (
    <>
      {node.title.trim() ? (
        <h2 className="text-[15px] font-medium tracking-[-0.02em] text-ink">{node.title}</h2>
      ) : null}
      {node.kind === "doc" ? (
        <DocFile projectId={projectId} node={node} title={node.title} />
      ) : (
        <div className="rounded-[8px] border border-border bg-canvas px-3 py-3">
          {node.body.trim() ? (
            <Markdown>{node.body}</Markdown>
          ) : (
            <p className="text-[13px] text-ink-tertiary">No content yet.</p>
          )}
        </div>
      )}
    </>
  );
}

function Message({
  author,
  body,
  mentions,
}: {
  author: string;
  body: string;
  mentions: MentionTarget[];
}) {
  return (
    <div className="rounded-[8px] border border-border bg-canvas px-3 py-2">
      <p className="text-[11px] font-medium text-ink-secondary">{author}</p>
      <Markdown className="mt-0.5" mentions={mentions}>
        {body}
      </Markdown>
    </div>
  );
}

function CommentThread({ node, mentions }: { node: CommentNodeDto; mentions: MentionTarget[] }) {
  const hasBody = node.body.trim().length > 0;
  if (!hasBody && node.replies.length === 0) {
    return (
      <p className="px-1 text-[13px] text-ink-tertiary">No messages yet. Write below and send.</p>
    );
  }
  return (
    <div className="space-y-2">
      {hasBody ? <Message author={node.authorName} body={node.body} mentions={mentions} /> : null}
      {node.replies.map((reply) => (
        <Message key={reply.id} author={reply.authorName} body={reply.body} mentions={mentions} />
      ))}
    </div>
  );
}

function CommentComposer({ onSend }: { onSend: (message: string) => Promise<void> }) {
  const [text, setText] = useState("");
  const canSend = text.trim().length > 0;

  const send = () => {
    const message = text.trim();
    if (!message) return;
    setText("");
    onSend(message).catch(() => setText((current) => current || message));
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-end gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Write a comment… Use @Name to mention someone."
          aria-label="Comment"
          className="min-h-[44px] flex-1 resize-none rounded-[10px] border border-border bg-canvas px-3 py-2.5 text-[13px] leading-relaxed text-ink outline-none placeholder:text-ink-tertiary"
        />
        <button
          type="button"
          disabled={!canSend}
          onClick={send}
          aria-label="Send comment"
          className={clsx(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px]",
            canSend
              ? "bg-ink text-white transition-colors hover:bg-[#333333]"
              : "cursor-not-allowed bg-surface-soft text-ink-tertiary",
          )}
        >
          <ArrowUpIcon size={15} weight="bold" />
        </button>
      </div>
      <p className="text-[11px] text-ink-tertiary">Linked nodes are sent as context. ⌘↵ to send.</p>
    </div>
  );
}

type Props = {
  projectId: string;
  node: BoardNode;
  panelKey: string;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  mentions: MentionTarget[];
  busy: boolean;
  onClose: () => void;
  onDelete: () => void;
  onSave: SaveNode;
  onReply: (threadId: string, message: string) => Promise<void>;
};

export function NodePanel({
  projectId,
  node,
  panelKey,
  collapsed,
  onCollapsedChange,
  mentions,
  busy,
  onClose,
  onDelete,
  onSave,
  onReply,
}: Props) {
  const comment = isCommentNode(node) ? node : null;
  const editable = node.authorKind === "human" && node.kind !== "comment" ? node : null;

  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      <FloatingPanel
        title={boardKindLabel(node.kind)}
        collapsed={collapsed}
        onCollapsedChange={onCollapsedChange}
        onClose={onClose}
        scrollToBottomKey={comment ? `${panelKey}:${comment.replies.length}` : undefined}
        footer={
          comment ? (
            <CommentComposer key={panelKey} onSend={(message) => onReply(comment.id, message)} />
          ) : undefined
        }
      >
        <section key={panelKey} className="fade-up flex min-h-full flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge>{boardKindLabel(node.kind)}</StatusBadge>
            {comment ? (
              <MemberStack members={membersFor(node)} size="md" max={3} />
            ) : (
              <MemberAvatar member={toMember(node.authorKind, node.authorName)} size="md" />
            )}
            <button
              type="button"
              disabled={busy}
              onClick={onDelete}
              className="ml-auto flex h-7 items-center gap-1.5 rounded-[6px] px-2 text-[12px] text-ink-tertiary transition-colors hover:bg-surface-soft hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
            >
              <TrashIcon size={13} weight="bold" />
              Delete
            </button>
          </div>

          {comment ? (
            <CommentThread node={comment} mentions={mentions} />
          ) : editable ? (
            <NodeEditor projectId={projectId} node={editable} onSave={onSave} />
          ) : (
            <ReadOnlyNode projectId={projectId} node={node} />
          )}
        </section>
      </FloatingPanel>
    </div>
  );
}
