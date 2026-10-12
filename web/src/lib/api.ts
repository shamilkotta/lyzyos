import {
  boardEdgeSchema,
  memberPreviewSchema,
  nodeDtoSchema,
  projectDtoSchema,
  workspaceBoardSchema,
  workspaceDtoSchema,
} from "@lyzyos/db";
import { z } from "zod";
import type { BoardState } from "./project-types";
import { toBoardState } from "./project-types";
import type { MemberRole } from "./roles";
import { CLIENT_ID_HEADER, getOrCreateClientId } from "./sync-protocol";

const projectDetailSchema = projectDtoSchema.extend({
  workspaces: z.array(workspaceDtoSchema).optional(),
  members: z.array(memberPreviewSchema),
  projectMemberIds: z.array(z.string()).default([]),
});
const workspaceListItemSchema = workspaceDtoSchema.extend({
  project: projectDtoSchema,
  members: z.array(memberPreviewSchema),
});
const createProjectResultSchema = z.object({ projectId: z.string(), workspaceId: z.string() });
const edgeResultSchema = z.object({ edge: boardEdgeSchema });
const nullableNodeSchema = nodeDtoSchema.nullable();

const directoryUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  image: z.string().nullable(),
  role: z.string().nullable(),
  createdAt: z.number(),
});
export type DirectoryUser = z.infer<typeof directoryUserSchema>;
const directorySchema = z.object({ users: z.array(directoryUserSchema) });

const createdMemberSchema = z.object({
  user: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    role: z.string(),
    setupEmailSent: z.boolean(),
  }),
});

/** A non-2xx API response; `status` lets callers tell auth failures from other errors. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  /** Plain objects are sent as JSON; FormData is sent as multipart. */
  body?: FormData | object;
};

async function errorMessage(response: Response) {
  const text = await response.text().catch(() => "");
  try {
    const body: unknown = JSON.parse(text);
    if (body && typeof body === "object" && "error" in body && typeof body.error === "string") {
      return body.error;
    }
  } catch {
    // not JSON — fall through to the raw text
  }
  return text || response.statusText || `Request failed (${response.status})`;
}

/**
 * Calls an app API route. Every route answers `{ data }` on success and `{ error }` on failure;
 * this unwraps `data` and validates it, or throws an `ApiError` carrying the server's message.
 */
async function request<T>(url: string, schema: z.ZodType<T>, options: RequestOptions = {}) {
  const { method = "GET", body } = options;
  const headers: Record<string, string> = { [CLIENT_ID_HEADER]: getOrCreateClientId() };
  let payload: BodyInit | undefined;
  if (body instanceof FormData) {
    payload = body;
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  const response = await fetch(url, { method, headers, body: payload, cache: "no-store" });
  if (!response.ok) throw new ApiError(response.status, await errorMessage(response));

  const json: unknown = response.status === 204 ? null : await response.json();
  const data = json && typeof json === "object" && "data" in json ? json.data : json;
  return schema.parse(data);
}

const ok = z.unknown();

function workspacePath(projectId: string, workspaceId: string, suffix = "") {
  return `/api/projects/${projectId}/workspaces/${workspaceId}${suffix}`;
}

// --- projects -----------------------------------------------------------------------------

export function listProjects() {
  return request("/api/projects", z.array(projectDtoSchema));
}

export function listArchivedProjects() {
  return request("/api/projects/archived", z.array(projectDtoSchema));
}

export function getProject(projectId: string) {
  return request(`/api/projects/${projectId}`, projectDetailSchema);
}

export async function setProjectArchived(projectId: string, archived: boolean) {
  await request(`/api/projects/${projectId}`, ok, { method: "PATCH", body: { archived } });
}

export function createProject(input: { brief: string; files: File[] }) {
  const form = new FormData();
  form.set("brief", input.brief);
  for (const file of input.files) form.append("files", file);
  return request("/api/projects", createProjectResultSchema, { method: "POST", body: form });
}

export function addProjectMembers(projectId: string, userIds: string[]) {
  return request(
    `/api/projects/${projectId}/members`,
    z.object({ members: z.array(memberPreviewSchema), projectMemberIds: z.array(z.string()) }),
    { method: "POST", body: { userIds } },
  );
}

export async function fetchAgentStatus(projectId: string) {
  const { working } = await request(
    `/api/projects/${projectId}/agent-status`,
    z.object({ working: z.boolean() }),
  );
  return working;
}

// --- workspaces ---------------------------------------------------------------------------

export function listProjectWorkspaces(projectId: string) {
  return request(`/api/projects/${projectId}/workspaces`, z.array(workspaceListItemSchema));
}

export async function getWorkspaceBoard(projectId: string, workspaceId: string) {
  const board = await request(workspacePath(projectId, workspaceId), workspaceBoardSchema);
  return toBoardState(board) satisfies BoardState;
}

export function createWorkspace(projectId: string, input: { name: string; kind?: string }) {
  return request(
    `/api/projects/${projectId}/workspaces`,
    workspaceDtoSchema.extend({ members: z.array(memberPreviewSchema) }),
    { method: "POST", body: input },
  );
}

export function addWorkspaceMembers(projectId: string, workspaceId: string, userIds: string[]) {
  return request(
    workspacePath(projectId, workspaceId, "/members"),
    z.object({ members: z.array(memberPreviewSchema) }),
    { method: "POST", body: { userIds } },
  );
}

// --- board nodes & edges ------------------------------------------------------------------

export type PlaceNodeInput =
  | { kind: "note" | "comment"; title?: string; data?: string; x: number; y: number }
  | { kind: "doc"; title?: string; file: File; x: number; y: number };

export function placeProjectNode(projectId: string, workspaceId: string, input: PlaceNodeInput) {
  const form = new FormData();
  form.set("kind", input.kind);
  form.set("x", String(input.x));
  form.set("y", String(input.y));
  if (input.title != null) form.set("title", input.title);
  if (input.kind === "doc") form.set("file", input.file);
  else form.set("data", input.data ?? "");

  return request(workspacePath(projectId, workspaceId, "/nodes"), nullableNodeSchema, {
    method: "POST",
    body: form,
  });
}

export function updateProjectNode(
  projectId: string,
  workspaceId: string,
  nodeId: string,
  input: { title?: string; data?: string; x?: number; y?: number },
) {
  return request(workspacePath(projectId, workspaceId, `/nodes/${nodeId}`), nullableNodeSchema, {
    method: "PATCH",
    body: input,
  });
}

export async function deleteProjectNode(projectId: string, workspaceId: string, nodeId: string) {
  await request(workspacePath(projectId, workspaceId, `/nodes/${nodeId}`), ok, {
    method: "DELETE",
  });
}

export async function createProjectEdge(
  projectId: string,
  workspaceId: string,
  input: { sourceId: string; targetId: string },
) {
  const { edge } = await request(
    workspacePath(projectId, workspaceId, "/edges"),
    edgeResultSchema,
    {
      method: "POST",
      body: input,
    },
  );
  return edge;
}

export async function deleteProjectEdge(projectId: string, workspaceId: string, edgeId: string) {
  await request(workspacePath(projectId, workspaceId, `/edges/${edgeId}`), ok, {
    method: "DELETE",
  });
}

export function replyToCommentThread(
  projectId: string,
  workspaceId: string,
  input: { threadId: string; message: string },
) {
  return request(workspacePath(projectId, workspaceId, "/comment"), nullableNodeSchema, {
    method: "POST",
    body: input,
  });
}

// --- directory ----------------------------------------------------------------------------

export function listDirectory() {
  return request("/api/users", directorySchema);
}

export function createMember(input: { name: string; email: string; role: MemberRole }) {
  return request("/api/users", createdMemberSchema, { method: "POST", body: input });
}
