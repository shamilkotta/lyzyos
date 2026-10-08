"use client";

import { useMemo, useState } from "react";
import { Plus, Robot, SpinnerGap, User } from "@phosphor-icons/react";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { AGENT_ROLE } from "@lyzyos/db";
import { memberRoles, type DirectoryUser, type MemberRole } from "@/lib/api";
import { useCreateMember, useDirectory } from "@/lib/queries/projects";
import { useCurrentUser } from "@/lib/session";

const joinedFormat = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const roleLabel: Record<MemberRole, string> = {
  user: "Member",
  admin: "Admin",
  agent: "Agent",
};

function initials(name: string) {
  return (
    name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?"
  );
}

function Avatar({ person, agent }: { person: DirectoryUser; agent?: boolean }) {
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-canvas text-[11px] font-medium text-ink">
      {person.image ? (
        // oxlint-disable-next-line next/no-img-element
        <img src={person.image} alt="" className="h-full w-full object-cover" />
      ) : agent ? (
        <Robot size={16} weight="bold" />
      ) : (
        initials(person.name)
      )}
    </span>
  );
}

function Section({
  title,
  count,
  icon,
  children,
}: {
  title: string;
  count: number;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="flex items-center gap-1.5 text-[12px] font-medium uppercase tracking-[0.05em] text-ink-tertiary">
          {icon}
          {title}
        </h2>
        <span className="font-mono text-[11px] text-ink-tertiary">{count}</span>
      </div>
      <ul className="rounded-[12px] border border-border bg-surface">{children}</ul>
    </section>
  );
}

function AddMemberForm({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const createMember = useCreateMember();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<MemberRole>("user");
  const [notice, setNotice] = useState<string | null>(null);

  const reset = () => {
    setName("");
    setEmail("");
    setRole("user");
  };

  const submit = async () => {
    setNotice(null);
    try {
      const { user } = await createMember.mutateAsync({
        name: name.trim(),
        email: email.trim(),
        role,
      });
      setNotice(
        user.setupEmailSent
          ? `Invited ${user.name}. A password-setup link was emailed to ${user.email}.`
          : `Created agent account ${user.name}.`,
      );
      reset();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not add member.");
    }
  };

  if (!open) return notice ? <p className="mt-4 text-[12px] text-ink-secondary">{notice}</p> : null;

  const canSubmit = name.trim().length > 0 && email.trim().length > 0 && !createMember.isPending;

  return (
    <div className="fade-up mt-6 rounded-[12px] border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[13px] font-medium text-ink">Add a member</h2>
        <Button
          variant="ghost"
          onClick={() => {
            onOpenChange(false);
            reset();
          }}
        >
          Cancel
        </Button>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="space-y-1">
          <span className="text-[11px] font-medium uppercase tracking-[0.05em] text-ink-tertiary">
            Name
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ada Lovelace"
            className="w-full rounded-[8px] border border-border bg-canvas px-3 py-2 text-[13px] text-ink outline-none"
          />
        </label>
        <label className="space-y-1">
          <span className="text-[11px] font-medium uppercase tracking-[0.05em] text-ink-tertiary">
            Email
          </span>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            className="w-full rounded-[8px] border border-border bg-canvas px-3 py-2 text-[13px] text-ink outline-none"
          />
        </label>
        <label className="space-y-1">
          <span className="text-[11px] font-medium uppercase tracking-[0.05em] text-ink-tertiary">
            Role
          </span>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as MemberRole)}
            className="w-full rounded-[8px] border border-border bg-canvas px-3 py-2 text-[13px] text-ink outline-none"
          >
            {memberRoles.map((r) => (
              <option key={r} value={r}>
                {roleLabel[r]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="mt-2 text-[11px] text-ink-tertiary">
        {role === "agent"
          ? "Agent accounts have no password and get no email — they act through the agent worker."
          : "The member gets an email with a link to set their own password."}
      </p>
      <div className="mt-3 flex items-center gap-2">
        <Button onClick={() => void submit()} disabled={!canSubmit}>
          {createMember.isPending ? "Adding…" : "Send invite"}
        </Button>
      </div>
      {notice ? <p className="mt-3 text-[12px] text-ink-secondary">{notice}</p> : null}
    </div>
  );
}

export function TeamDirectory() {
  const { data, isLoading, error } = useDirectory();
  const { user: me } = useCurrentUser();
  const [addOpen, setAddOpen] = useState(false);

  const { agents, people, isAdmin } = useMemo(() => {
    const users = data?.users ?? [];
    return {
      agents: users.filter((u) => u.role === AGENT_ROLE),
      people: users.filter((u) => u.role !== AGENT_ROLE),
      isAdmin: users.find((u) => u.id === me?.id)?.role === "admin",
    };
  }, [data?.users, me?.id]);

  return (
    <div className="h-full overflow-auto">
      <div className="mx-auto max-w-3xl px-8 py-12 fade-up">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-[28px] font-medium tracking-[-0.03em] text-ink">Members</h1>
            <p className="mt-2 text-[14px] text-ink-secondary">
              Everyone who works in LyzyOS — people and agents share the same rooms and board
              objects.
            </p>
          </div>
          {isAdmin && !addOpen ? (
            <Button
              variant="secondary"
              className="shrink-0"
              onClick={() => setAddOpen(true)}
            >
              <Plus size={14} weight="bold" />
              Add member
            </Button>
          ) : null}
        </div>

        {isAdmin ? <AddMemberForm open={addOpen} onOpenChange={setAddOpen} /> : null}

        {isLoading ? (
          <div className="mt-8 flex items-center gap-2 text-[13px] text-ink-tertiary">
            <SpinnerGap size={14} className="animate-spin" />
            Loading team…
          </div>
        ) : error ? (
          <p className="mt-8 text-[13px] text-ink-secondary">Could not load the team.</p>
        ) : (
          <>
            <Section title="Agents" count={agents.length} icon={<Robot size={13} weight="bold" />}>
              {agents.map((agent) => (
                <li
                  key={agent.id}
                  className="flex items-center justify-between gap-4 border-b border-border px-4 py-3 last:border-0"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar person={agent} agent />
                    <div className="min-w-0">
                      <p className="text-[14px] font-medium text-ink">{agent.name}</p>
                      <p className="mt-0.5 text-[12px] text-ink-secondary">
                        Project agent · joins every workspace
                      </p>
                    </div>
                  </div>
                  <StatusBadge tone="ok">Always on</StatusBadge>
                </li>
              ))}
            </Section>

            <Section title="People" count={people.length} icon={<User size={13} weight="bold" />}>
              {people.map((person) => (
                <li
                  key={person.id}
                  className="flex items-center justify-between gap-4 border-b border-border px-4 py-3 last:border-0"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar person={person} />
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-medium text-ink">
                        {person.name}
                        {person.id === me?.id ? (
                          <span className="ml-2 text-[12px] font-normal text-ink-tertiary">
                            (you)
                          </span>
                        ) : null}
                      </p>
                      <p className="mt-0.5 truncate text-[12px] text-ink-secondary">
                        {person.email}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    {person.role === "admin" ? <StatusBadge tone="info">Admin</StatusBadge> : null}
                    <span className="font-mono text-[11px] text-ink-tertiary">
                      Joined {joinedFormat.format(person.createdAt)}
                    </span>
                  </div>
                </li>
              ))}
            </Section>
          </>
        )}
      </div>
    </div>
  );
}
