import { isRecord } from "@lyzyos/utils";
import {
  boardEdgeSchema,
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
});
const workspaceListItemSchema = workspaceDtoSchema.extend({
  project: projectDtoSchema,
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
    throw new Error(text || response.statusText);
  }
  if (response.status === 204) return null;
  const body: unknown = await response.json();
  return body;
}

function unwrapData(payload: unknown) {
  if (isRecord(payload) && "data" in payload) return payload.data;
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
        await parseJson(await fetch(`/api/projects/${projectId}/workspaces`, { cache: "no-store" })),
      ),
    );
}

export async function getWorkspaceBoard(projectId: string, workspaceId: string): Promise<BoardState> {
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

export type { BoardNode, NodeDto };
