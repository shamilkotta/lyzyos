"use client";

import { useState } from "react";
import { X, Sparkle } from "@phosphor-icons/react";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
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

export function NewBriefModal({ open, onClose, onCreated }: Props) {
  const [brief, setBrief] = useState(
    "Launch SecureEdge Enterprise across the US, UK and Germany. Target enterprise CTOs and security leaders. Emphasize detection speed and SOC efficiency. Soft launch Nov 10.",
  );
  const [phase, setPhase] = useState<"input" | "analyzing" | "review">("input");

  if (!open) return null;

  const analyze = () => {
    setPhase("analyzing");
    window.setTimeout(() => setPhase("review"), 1100);
  };

  const resetAndClose = () => {
    setPhase("input");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/20 px-4 backdrop-blur-[2px]">
      <button
        type="button"
        className="absolute inset-0"
        aria-label="Close"
        onClick={resetAndClose}
      />
      <div className="relative w-full max-w-2xl overflow-hidden rounded-[12px] border border-border bg-surface shadow-[0_2px_8px_rgba(0,0,0,0.04)] fade-up">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <p className="text-[13px] font-medium text-ink">New campaign space</p>
            <p className="text-[12px] text-ink-secondary">Brief first. Structure later.</p>
          </div>
          <button
            type="button"
            onClick={resetAndClose}
            className="flex h-7 w-7 items-center justify-center rounded-[6px] text-ink-tertiary hover:bg-surface-soft"
          >
            <X size={14} weight="bold" />
          </button>
        </div>

        <div className="px-4 py-4">
          {phase === "input" ? (
            <div className="space-y-3">
              <textarea
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                rows={7}
                className="w-full resize-none rounded-[8px] border border-border bg-canvas px-3 py-3 text-[14px] leading-relaxed text-ink outline-none focus:border-border-strong"
                placeholder="Paste a client brief, or describe the campaign…"
              />
              <div className="flex items-center justify-between">
                <p className="text-[12px] text-ink-tertiary">Or upload a brief document</p>
                <Button onClick={analyze}>Analyze brief</Button>
              </div>
            </div>
          ) : null}

          {phase === "analyzing" ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Sparkle size={22} weight="fill" className="text-pale-blue-ink" />
              <p className="mt-3 text-[14px] font-medium text-ink">Reading the brief…</p>
              <p className="mt-1 text-[13px] text-ink-secondary">
                Extracting objective, audience, markets, and gaps.
              </p>
            </div>
          ) : null}

          {phase === "review" ? (
            <div className="space-y-5">
              <div>
                <StatusBadge tone="info">Structured</StatusBadge>
                <h2 className="mt-2 text-[18px] font-medium tracking-[-0.02em] text-ink">
                  SecureEdge Enterprise Launch
                </h2>
              </div>

              <dl className="grid gap-3 sm:grid-cols-2">
                {extracted.map((row) => (
                  <div key={row.label} className="rounded-[8px] border border-border px-3 py-2.5">
                    <dt className="text-[11px] font-medium uppercase tracking-[0.05em] text-ink-tertiary">
                      {row.label}
                    </dt>
                    <dd className="mt-1 text-[13px] text-ink">{row.value}</dd>
                  </div>
                ))}
              </dl>

              <div className="rounded-[8px] border border-pale-yellow-ink/20 bg-pale-yellow px-3 py-3">
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

              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={() => setPhase("input")}>
                  Edit brief
                </Button>
                <Button
                  onClick={() => {
                    onCreated();
                    setPhase("input");
                  }}
                >
                  Open workspace
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
