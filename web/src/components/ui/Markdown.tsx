"use client";

import { useMemo } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import clsx from "clsx";

export type MentionTarget = { id: string; name: string; kind: "human" | "agent" };

type Props = {
  children: string;
  /** `compact` flattens headings for small canvas cards; `full` is the readable panel style. */
  variant?: "compact" | "full";
  className?: string;
  /** People/agents in scope. `@handle`s that resolve to one of them render as a mention chip. */
  mentions?: MentionTarget[];
};

const MENTION_HREF = "#mention:";
// Same shape the backend uses to detect mentions; trailing sentence punctuation is trimmed below.
const MENTION_PATTERN = /(^|[^\w@])@([A-Za-z][\w.-]*)/g;
// Code spans/blocks are left untouched so `@decorators` in code never become chips.
const CODE_PATTERN = /(```[\s\S]*?```|`[^`\n]*`)/g;
const AGENT_HANDLES = ["lyzy", "agent"];

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function buildHandleIndex(targets: MentionTarget[]) {
  const index = new Map<string, MentionTarget>();
  for (const target of targets) {
    const full = normalize(target.name);
    const first = normalize(target.name.split(/\s+/)[0] ?? "");
    for (const key of [full, first, ...(target.kind === "agent" ? AGENT_HANDLES : [])]) {
      if (key && !index.has(key)) index.set(key, target);
    }
  }
  return index;
}

/** Rewrites resolvable `@handle`s to links the custom `a` renderer turns into chips. */
function linkMentions(text: string, index: Map<string, MentionTarget>) {
  return text
    .split(CODE_PATTERN)
    .map((chunk, i) => {
      if (i % 2 === 1) return chunk; // code
      return chunk.replace(MENTION_PATTERN, (match, lead: string, rawHandle: string) => {
        const handle = rawHandle.replace(/[.-]+$/, "");
        const trailing = rawHandle.slice(handle.length);
        const target = index.get(normalize(handle));
        if (!target) return match;
        return `${lead}[@${handle}](${MENTION_HREF}${target.kind}:${encodeURIComponent(target.id)})${trailing}`;
      });
    })
    .join("");
}

// Raw HTML is not rendered (react-markdown default), so agent/user text cannot inject markup.
const components: Components = {
  a: ({ node: _node, href, children, ...props }) => {
    if (href?.startsWith(MENTION_HREF)) {
      const kind = href.slice(MENTION_HREF.length).split(":")[0];
      return (
        <span className={clsx("mention", kind === "agent" && "mention-agent")}>{children}</span>
      );
    }
    return (
      <a
        {...props}
        href={href}
        target="_blank"
        rel="noreferrer noopener"
        className="text-ink underline underline-offset-2 hover:text-ink-secondary"
      >
        {children}
      </a>
    );
  },
};

export function Markdown({ children, variant = "full", className, mentions }: Props) {
  const index = useMemo(() => (mentions?.length ? buildHandleIndex(mentions) : null), [mentions]);
  const source = index ? linkMentions(children, index) : children;

  return (
    <div className={clsx("markdown", variant === "compact" && "markdown-compact", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {source}
      </ReactMarkdown>
    </div>
  );
}
