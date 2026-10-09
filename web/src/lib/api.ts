import {
  boardEdgeSchema,
  memberPreviewSchema,
  nodeDtoSchema,
  projectDtoSchema,
  workspaceBoardSchema,
  workspaceDtoSchema,
  type NodeDto,
} from "@lyzyos/db";
import { z } from "zod";
import type { BoardNode, BoardState } from "./project-types";
import { toBoardState } from "./project-types";
import { CLIENT_ID_HEADER, getOrCreateClientId } from "./sync-protocol";

const projectDetailSchema = projectDtoSchema.extend({
  workspaces: z.array(workspaceDtoSchema),
  members: z.array(memberPreviewSchema),
  projectMemberIds: z.array(z.string()).default([]),
});
const workspaceListItemSchema = workspaceDtoSchema.extend({
  project: projectDtoSchema,
  members: z.array(memberPreviewSchema),
});
const createProjectResultSchema = z.object({
  projectId: z.string(),
  workspaceId: z.string(),
});
const edgeResultSchema = z.object({
  edge: boardEdgeSchema,
});

function clientHeaders(extra?: HeadersInit): HeadersInit {
  return {
    ...extra,
    [CLIENT_ID_HEADER]: getOrCreateClientId(),
  };
}

async function parseJson(response: Response) {
  if (!response.ok) {
    const text = await response.text();
    let message = text || response.statusText;
    try {
      const body: unknown = JSON.parse(text);
      if (
        typeof body === "object" &&
        body !== null &&
        "error" in body &&
        typeof body.error === "string"
      ) {
        message = body.error;
      }
    } catch {
      // keep raw text
    }
    throw new Error(message);
  }
  if (response.status === 204) return null;
  const body: unknown = await response.json();
  return body;
}

function unwrapData(payload: unknown) {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "data" in payload &&
    typeof payload.data === "object"
  ) {
    return payload.data;
  }
  return payload;
}

function workspacePath(projectId: string, workspaceId: string, suffix = "") {
  return `/api/projects/${projectId}/workspaces/${workspaceId}${suffix}`;
}

function parseNode(payload: unknown) {
  const data = unwrapData(payload);
  if (data == null) return null;
  return nodeDtoSchema.parse(data);
}

export async function listProjects() {
  return z
    .array(projectDtoSchema)
    .parse(unwrapData(await parseJson(await fetch("/api/projects", { cache: "no-store" }))));
}

export async function listArchivedProjects() {
  return z
    .array(projectDtoSchema)
    .parse(
      unwrapData(await parseJson(await fetch("/api/projects/archived", { cache: "no-store" }))),
    );
}

export async function archiveProject(projectId: string) {
  await parseJson(
    await fetch(`/api/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: true }),
    }),
  );
}

export async function unarchiveProject(projectId: string) {
  await parseJson(
    await fetch(`/api/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: false }),
    }),
  );
}

export async function getProject(projectId: string) {
  return projectDetailSchema.parse(
    unwrapData(await parseJson(await fetch(`/api/projects/${projectId}`, { cache: "no-store" }))),
  );
}

export async function listProjectWorkspaces(projectId: string) {
  return z
    .array(workspaceListItemSchema)
    .parse(
      unwrapData(
        await parseJson(
          await fetch(`/api/projects/${projectId}/workspaces`, { cache: "no-store" }),
        ),
      ),
    );
}

export async function getWorkspaceBoard(
  projectId: string,
  workspaceId: string,
): Promise<BoardState> {
  const payload = unwrapData(
    await parseJson(await fetch(workspacePath(projectId, workspaceId), { cache: "no-store" })),
  );
  return toBoardState(workspaceBoardSchema.parse(payload));
}

export async function createProject(input: { brief: string; files: File[] }) {
  const form = new FormData();
  form.set("brief", input.brief);
  for (const file of input.files) {
    form.append("files", file);
  }
  const payload = unwrapData(
    await parseJson(
      await fetch("/api/projects", {
        method: "POST",
        headers: clientHeaders(),
        body: form,
      }),
    ),
  );
  return createProjectResultSchema.parse(payload);
}

export async function placeProjectNode(
  projectId: string,
  workspaceId: string,
  input: {
    kind: "note" | "comment" | "doc";
    title?: string;
    data?: string;
    file?: File;
    x: number;
    y: number;
  },
) {
  const form = new FormData();
  form.set("kind", input.kind);
  form.set("x", String(input.x));
  form.set("y", String(input.y));
  if (input.title != null) form.set("title", input.title);
  if (input.kind === "doc") {
    if (!input.file) throw new Error("File is required for document nodes.");
    form.set("file", input.file);
  } else {
    form.set("data", input.data ?? "");
  }

  const node = parseNode(
    await parseJson(
      await fetch(workspacePath(projectId, workspaceId, "/nodes"), {
        method: "POST",
        headers: clientHeaders(),
        body: form,
      }),
    ),
  );
  return { node };
}

export async function createProjectEdge(
  projectId: string,
  workspaceId: string,
  input: { sourceId: string; targetId: string },
) {
  const payload = unwrapData(
    await parseJson(
      await fetch(workspacePath(projectId, workspaceId, "/edges"), {
        method: "POST",
        headers: clientHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(input),
      }),
    ),
  );
  return edgeResultSchema.parse(payload);
}

export async function deleteProjectEdge(projectId: string, workspaceId: string, edgeId: string) {
  unwrapData(
    await parseJson(
      await fetch(workspacePath(projectId, workspaceId, `/edges/${edgeId}`), {
        method: "DELETE",
        headers: clientHeaders(),
      }),
    ),
  );
  return { ok: true };
}

export async function deleteProjectNode(projectId: string, workspaceId: string, nodeId: string) {
  unwrapData(
    await parseJson(
      await fetch(workspacePath(projectId, workspaceId, `/nodes/${nodeId}`), {
        method: "DELETE",
        headers: clientHeaders(),
      }),
    ),
  );
  return { ok: true };
}

export async function updateProjectNode(
  projectId: string,
  workspaceId: string,
  nodeId: string,
  input: { title?: string; data?: string; x?: number; y?: number },
) {
  const node = parseNode(
    await parseJson(
      await fetch(workspacePath(projectId, workspaceId, `/nodes/${nodeId}`), {
        method: "PATCH",
        headers: clientHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(input),
      }),
    ),
  );
  return { node };
}

export async function addProjectDocument(
  projectId: string,
  workspaceId: string,
  file: File,
  position?: { x: number; y: number },
) {
  return placeProjectNode(projectId, workspaceId, {
    kind: "doc",
    title: "",
    file,
    x: position?.x ?? 0,
    y: position?.y ?? 0,
  });
}

export async function replyToCommentThread(
  projectId: string,
  workspaceId: string,
  input: { threadId: string; message: string },
) {
  const node = parseNode(
    await parseJson(
      await fetch(workspacePath(projectId, workspaceId, "/comment"), {
        method: "POST",
        headers: clientHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(input),
      }),
    ),
  );
  return { node };
}

export const memberRoles = ["user", "admin", "agent"] as const;
export type MemberRole = (typeof memberRoles)[number];

const directoryUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  image: z.string().nullable(),
  role: z.string().nullable(),
  createdAt: z.number(),
});
export type DirectoryUser = z.infer<typeof directoryUserSchema>;

const directorySchema = z.object({
  users: z.array(directoryUserSchema),
});
export type Directory = z.infer<typeof directorySchema>;

export async function listDirectory() {
  return directorySchema.parse(
    unwrapData(await parseJson(await fetch("/api/users", { cache: "no-store" }))),
  );
}

const createdMemberSchema = z.object({
  user: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    role: z.string(),
    setupEmailSent: z.boolean(),
  }),
});

export async function createMember(input: { name: string; email: string; role: MemberRole }) {
  const payload = unwrapData(
    await parseJson(
      await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }),
    ),
  );
  return createdMemberSchema.parse(payload);
}

export async function updateWorkspace(
  projectId: string,
  workspaceId: string,
  input: { status?: string; statusNote?: string | null; attention?: string | null },
) {
  const updated = workspaceDtoSchema.parse(
    unwrapData(
      await parseJson(
        await fetch(workspacePath(projectId, workspaceId), {
          method: "PATCH",
          headers: clientHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify(input),
        }),
      ),
    ),
  );
  return updated;
}

const createWorkspaceResultSchema = workspaceDtoSchema.extend({
  members: z.array(memberPreviewSchema),
});

export async function createWorkspace(projectId: string, input: { name: string; kind?: string }) {
  const payload = unwrapData(
    await parseJson(
      await fetch(`/api/projects/${projectId}/workspaces`, {
        method: "POST",
        headers: clientHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(input),
      }),
    ),
  );
  return createWorkspaceResultSchema.parse(payload);
}

const addWorkspaceMembersResultSchema = z.object({
  members: z.array(memberPreviewSchema),
});

export async function addWorkspaceMembers(
  projectId: string,
  workspaceId: string,
  userIds: string[],
) {
  const payload = unwrapData(
    await parseJson(
      await fetch(workspacePath(projectId, workspaceId, "/members"), {
        method: "POST",
        headers: clientHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ userIds }),
      }),
    ),
  );
  return addWorkspaceMembersResultSchema.parse(payload);
}

const addProjectMembersResultSchema = z.object({
  members: z.array(memberPreviewSchema),
  projectMemberIds: z.array(z.string()),
});

export async function addProjectMembers(projectId: string, userIds: string[]) {
  const payload = unwrapData(
    await parseJson(
      await fetch(`/api/projects/${projectId}/members`, {
        method: "POST",
        headers: clientHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ userIds }),
      }),
    ),
  );
  return addProjectMembersResultSchema.parse(payload);
}

export async function fetchAgentStatus(projectId: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/projects/${projectId}/agent-status`, {
      headers: clientHeaders(),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { working: boolean };
    return data.working ?? false;
  } catch {
    return false;
  }
}

export type { BoardNode, NodeDto };
