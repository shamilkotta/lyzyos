import type { ApiProjectListItem, BoardState, PlanningNode, Project } from "./project-types";
import { CLIENT_ID_HEADER, getOrCreateClientId } from "./sync-protocol";

const base = () => process.env.NEXT_PUBLIC_API_BASE ?? "";

function clientHeaders(extra?: HeadersInit): HeadersInit {
  return {
    ...extra,
    [CLIENT_ID_HEADER]: getOrCreateClientId(),
  };
}

async function parse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || response.statusText);
  }
  return response.json() as Promise<T>;
}

export async function listProjects(): Promise<ApiProjectListItem[]> {
  const data = await parse<{ projects: ApiProjectListItem[] }>(
    await fetch(`${base()}/api/projects`, { cache: "no-store" }),
  );
  return data.projects;
}

export async function getProjectBoard(projectId: string): Promise<{
  project: Project;
  nodes: PlanningNode[];
  edges: BoardState["edges"];
}> {
  return parse(await fetch(`${base()}/api/projects/${projectId}`, { cache: "no-store" }));
}

export async function createProject(input: {
  brief: string;
  files: File[];
}): Promise<{ projectId: string; project?: Project; nodes: PlanningNode[] }> {
  const form = new FormData();
  form.set("brief", input.brief);
  for (const file of input.files) {
    form.append("files", file);
  }
  return parse(
    await fetch(`${base()}/api/projects`, {
      method: "POST",
      headers: clientHeaders(),
      body: form,
    }),
  );
}

export async function placeProjectNode(
  projectId: string,
  input: {
    kind: "note" | "question";
    title?: string;
    text?: string;
    x: number;
    y: number;
  },
) {
  return parse<{ node: PlanningNode }>(
    await fetch(`${base()}/api/projects/${projectId}/nodes`, {
      method: "POST",
      headers: clientHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(input),
    }),
  );
}

export async function createProjectEdge(
  projectId: string,
  input: { sourceId: string; targetId: string },
) {
  return parse<{ edge: BoardState["edges"][number] }>(
    await fetch(`${base()}/api/projects/${projectId}/edges`, {
      method: "POST",
      headers: clientHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(input),
    }),
  );
}

export async function deleteProjectEdge(projectId: string, edgeId: string) {
  return parse<{ ok: boolean }>(
    await fetch(`${base()}/api/projects/${projectId}/edges/${edgeId}`, {
      method: "DELETE",
      headers: clientHeaders(),
    }),
  );
}

export async function updateProjectNode(
  projectId: string,
  nodeId: string,
  input: { title?: string; text?: string; x?: number; y?: number },
) {
  return parse<{ node: PlanningNode }>(
    await fetch(`${base()}/api/projects/${projectId}/nodes/${nodeId}`, {
      method: "PATCH",
      headers: clientHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(input),
    }),
  );
}

export async function answerProjectQuestion(projectId: string, nodeId: string, text: string) {
  return parse<{ answer: PlanningNode }>(
    await fetch(`${base()}/api/projects/${projectId}/nodes/${nodeId}/answer`, {
      method: "POST",
      headers: clientHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ text }),
    }),
  );
}

export async function addProjectDocument(
  projectId: string,
  file: File,
  position?: { x: number; y: number },
) {
  const form = new FormData();
  form.set("file", file);
  if (position) {
    form.set("x", String(position.x));
    form.set("y", String(position.y));
  }
  return parse<{ ok: boolean; node?: PlanningNode }>(
    await fetch(`${base()}/api/projects/${projectId}/documents`, {
      method: "POST",
      headers: clientHeaders(),
      body: form,
    }),
  );
}
