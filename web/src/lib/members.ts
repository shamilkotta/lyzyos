import type { MemberPreview } from "@lyzyos/db";
import { initials } from "./format";
import type { Member, MemberKind } from "./types";

function normalizeHandle(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ");
}

/** Loose name match: exact after normalizing, or same first name (`@maya` ≈ "Maya Chen"). */
export function handlesMatch(a: string, b: string) {
  const left = normalizeHandle(a);
  const right = normalizeHandle(b);
  if (!left || !right) return false;
  return left === right || left.split(" ")[0] === right.split(" ")[0];
}

export function toMember(
  kind: MemberKind,
  name: string,
  opts?: { id?: string; image?: string | null; status?: Member["status"] },
): Member {
  return {
    id: opts?.id ?? `${kind}:${name.trim().toLowerCase()}`,
    name,
    role: kind === "agent" ? "Project agent" : "Member",
    kind,
    initials: initials(name),
    status: opts?.status ?? "online",
    image: opts?.image ?? null,
  };
}

type RosterEntry = Pick<MemberPreview, "id" | "name"> & {
  image?: string | null;
  kind?: MemberPreview["kind"];
};

/**
 * Maps a roster to display members. Agents are always present (working while mid-turn); humans
 * are online when a connected sync peer carries their name.
 */
export function membersFromRoster(
  roster: RosterEntry[],
  presence?: { onlineNames?: string[]; agentWorking?: boolean },
): Member[] {
  const onlineNames = presence?.onlineNames ?? [];
  const byId = new Map<string, Member>();
  for (const entry of roster) {
    if (!entry.id || byId.has(entry.id)) continue;
    const kind = entry.kind ?? "human";
    const status: Member["status"] =
      kind === "agent"
        ? presence?.agentWorking
          ? "working"
          : "online"
        : onlineNames.some((name) => handlesMatch(name, entry.name))
          ? "online"
          : "away";
    byId.set(entry.id, toMember(kind, entry.name, { id: entry.id, image: entry.image, status }));
  }
  return [...byId.values()];
}
