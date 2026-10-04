"use client";

import { ArrowRight, CirclesFour, DotOutline } from "@phosphor-icons/react";
import { spaces, attentionQueue, agents } from "@/lib/data";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import clsx from "clsx";

type Props = {
  onOpenSpace: (id: string) => void;
  onNewSpace: () => void;
  rail: "home" | "spaces" | "knowledge" | "agents" | "settings";
};

export function HomeDesktop({ onOpenSpace, onNewSpace, rail }: Props) {
  if (rail === "knowledge") return <KnowledgeSurface />;
  if (rail === "agents") return <AgentsSurface />;
  if (rail === "settings") return <SettingsSurface />;

  return (
    <div className="relative h-full overflow-auto">
      <div className="ambient-blob left-[10%] top-[8%]" />
      <div
        className="ambient-blob right-[-10%] bottom-[-20%]"
        style={{
          background: "radial-gradient(circle, rgba(251,243,219,0.65) 0%, rgba(247,246,243,0) 70%)",
          animationDelay: "-10s",
        }}
      />

      <div className="relative z-10 mx-auto max-w-5xl px-8 py-12">
        <header className="mb-10 fade-up">
          <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-tertiary">
            Marketing operations desk
          </p>
          <h1 className="mt-2 font-serif text-[40px] leading-[1.05] tracking-[-0.035em] text-ink">
            Workbench
          </h1>
          <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-ink-secondary">
            Open a campaign space. Agents work on the board with you — drag assets, leave comments,
            resolve blockers, decide what ships.
          </p>
          <div className="mt-5 flex items-center gap-2">
            <Button onClick={onNewSpace}>New from brief</Button>
            <Button variant="secondary" onClick={() => onOpenSpace("secureedge")}>
              Resume SecureEdge
              <ArrowRight size={14} weight="bold" />
            </Button>
          </div>
        </header>

        <section className="mb-10">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-[12px] font-medium uppercase tracking-[0.05em] text-ink-tertiary">
              Open spaces
            </h2>
            <span className="font-mono text-[11px] text-ink-tertiary">{spaces.length} running</span>
          </div>

          <div className="stagger grid gap-3 md:grid-cols-3">
            {spaces.map((space, index) => (
              <button
                key={space.id}
                type="button"
                onClick={() => onOpenSpace(space.id)}
                className={clsx(
                  "group rounded-[12px] border border-border bg-surface p-4 text-left transition-[box-shadow,border-color,transform] duration-200",
                  "hover:border-border-strong hover:shadow-[0_2px_8px_rgba(0,0,0,0.04)] active:scale-[0.99]",
                )}
                style={{ ["--index" as string]: index }}
              >
                <div className="mb-4 flex items-center justify-between">
                  <span className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-canvas text-ink">
                    <CirclesFour size={15} weight="bold" />
                  </span>
                  <StatusBadge
                    tone={
                      space.status === "blocked"
                        ? "danger"
                        : space.status === "ready"
                          ? "ok"
                          : "info"
                    }
                  >
                    {space.status === "blocked"
                      ? "Blocked"
                      : space.status === "ready"
                        ? "Ready"
                        : "In progress"}
                  </StatusBadge>
                </div>

                {/* faux window chrome */}
                <div className="mb-3 overflow-hidden rounded-[8px] border border-border bg-canvas">
                  <div className="flex h-6 items-center gap-1 border-b border-border bg-surface px-2">
                    <DotOutline size={14} weight="fill" className="text-border-strong" />
                    <DotOutline size={14} weight="fill" className="text-border-strong" />
                    <DotOutline size={14} weight="fill" className="text-border-strong" />
                  </div>
                  <div className="grid h-20 grid-cols-3 gap-1.5 p-2">
                    <div className="rounded-[4px] border border-border bg-surface" />
                    <div className="rounded-[4px] border border-border bg-pale-yellow/80" />
                    <div className="rounded-[4px] border border-border bg-pale-red/80" />
                  </div>
                </div>

                <h3 className="text-[14px] font-medium tracking-[-0.01em] text-ink">
                  {space.name}
                </h3>
                <p className="mt-1 text-[12px] text-ink-secondary">
                  {space.client} · Launch {space.launchDate}
                </p>
                <div className="mt-3 flex items-center justify-between text-[12px] text-ink-tertiary">
                  <span>{space.stage}</span>
                  <span className="font-mono">
                    {space.attention > 0 ? `${space.attention} need you` : "Clear"}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="grid gap-6 md:grid-cols-[1.2fr_0.8fr]">
          <div>
            <h2 className="mb-3 text-[12px] font-medium uppercase tracking-[0.05em] text-ink-tertiary">
              Waiting on you
            </h2>
            <ul className="rounded-[12px] border border-border bg-surface">
              {attentionQueue.map((item) => (
                <li
                  key={item.id}
                  className="flex items-start justify-between gap-3 border-b border-border px-4 py-3 last:border-0"
                >
                  <div>
                    <p className="text-[13px] font-medium text-ink">{item.title}</p>
                    <p className="mt-0.5 text-[12px] text-ink-secondary">
                      {item.campaignName} · {item.reason}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onOpenSpace(item.campaignId)}
                    className="shrink-0 text-[12px] font-medium text-ink underline-offset-2 hover:underline"
                  >
                    Open
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="mb-3 text-[12px] font-medium uppercase tracking-[0.05em] text-ink-tertiary">
              Agents online
            </h2>
            <ul className="rounded-[12px] border border-border bg-surface">
              {agents.map((agent) => (
                <li
                  key={agent.id}
                  className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 last:border-0"
                >
                  <div>
                    <p className="text-[13px] font-medium text-ink">{agent.name}</p>
                    <p className="text-[12px] text-ink-secondary">{agent.lastAction}</p>
                  </div>
                  <span
                    className={clsx(
                      "h-1.5 w-1.5 shrink-0 rounded-full",
                      agent.status === "working"
                        ? "bg-pale-green-ink"
                        : agent.status === "waiting"
                          ? "bg-pale-yellow-ink"
                          : "bg-ink-tertiary",
                    )}
                  />
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}

function KnowledgeSurface() {
  const groups = [
    {
      title: "Brand",
      items: ["Brand Guidelines", "Voice & Tone", "Terminology"],
    },
    {
      title: "Product",
      items: ["SecureEdge Overview", "Approved Claims v2.1", "Pricing notes"],
    },
    {
      title: "Markets",
      items: ["United States", "United Kingdom", "Germany"],
    },
    {
      title: "Policies",
      items: ["Legal", "Accessibility", "Regional Rules"],
    },
  ];

  return (
    <div className="mx-auto max-w-4xl px-8 py-12 fade-up">
      <h1 className="font-serif text-[32px] tracking-[-0.03em] text-ink">Knowledge</h1>
      <p className="mt-2 text-[14px] text-ink-secondary">
        Sources agents read before they generate, check, or localize.
      </p>
      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {groups.map((group) => (
          <div key={group.title} className="rounded-[12px] border border-border bg-surface p-4">
            <h2 className="text-[12px] font-medium uppercase tracking-[0.05em] text-ink-tertiary">
              {group.title}
            </h2>
            <ul className="mt-3 space-y-0">
              {group.items.map((item) => (
                <li
                  key={item}
                  className="border-b border-border py-2 text-[13px] text-ink last:border-0"
                >
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

function AgentsSurface() {
  return (
    <div className="mx-auto max-w-3xl px-8 py-12 fade-up">
      <h1 className="font-serif text-[32px] tracking-[-0.03em] text-ink">Agents</h1>
      <p className="mt-2 text-[14px] text-ink-secondary">
        Roles that execute work. Humans keep decisions and publish rights.
      </p>
      <ul className="mt-8 rounded-[12px] border border-border bg-surface">
        {agents.map((agent) => (
          <li
            key={agent.id}
            className="flex items-start justify-between gap-4 border-b border-border px-4 py-4 last:border-0"
          >
            <div>
              <p className="text-[14px] font-medium text-ink">{agent.name}</p>
              <p className="mt-0.5 text-[12px] text-ink-secondary">{agent.role}</p>
              <p className="mt-2 text-[13px] text-ink-secondary">{agent.lastAction}</p>
            </div>
            <StatusBadge
              tone={
                agent.status === "working" ? "ok" : agent.status === "waiting" ? "warn" : "neutral"
              }
            >
              {agent.status}
            </StatusBadge>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SettingsSurface() {
  return (
    <div className="mx-auto max-w-xl px-8 py-12 fade-up">
      <h1 className="font-serif text-[32px] tracking-[-0.03em] text-ink">Settings</h1>
      <p className="mt-2 text-[14px] text-ink-secondary">
        Workspace defaults. Kept quiet on purpose.
      </p>
      <div className="mt-8 space-y-0 rounded-[12px] border border-border bg-surface">
        {[
          "Organization · Northwind Marketing Ops",
          "Default markets · US, UK, DE",
          "Approval chain · Brand → Legal → Client",
          "Agent autonomy · Draft + QA, never publish",
        ].map((row) => (
          <div
            key={row}
            className="border-b border-border px-4 py-3 text-[13px] text-ink last:border-0"
          >
            {row}
          </div>
        ))}
      </div>
    </div>
  );
}
