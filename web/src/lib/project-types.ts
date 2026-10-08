import {
  isCommentNode,
  isDocNode,
  isNoteNode,
  type BoardEdge,
  type CommentNodeDto,
  type DocNodeDto,
  type DocPreviewKind,
  type MemberPreview,
  type NodeAuthor,
  type NodeDto,
  type NoteNodeDto,
  type ProjectDto,
  type WorkspaceBoard,
  type WorkspaceDto,
} from "@lyzyos/db";

export type { BoardEdge, CommentNodeDto, DocNodeDto, DocPreviewKind, NoteNodeDto };
export type BoardNode = NodeDto;
export type PlanningNode = NodeDto;
export type BoardNodeKind = NodeDto["kind"];
export type ProjectStatus = ProjectDto["status"];
export type Project = ProjectDto;
export type Workspace = WorkspaceDto & { project?: Project };
export type ApiAuthor = MemberPreview;
export type { NodeAuthor };
export type ApiProjectListItem = Project;
export type ApiProjectDetail = Project & { workspaces: Workspace[] };
export type ApiWorkspaceListItem = Workspace & { project: Project };
export type ApiWorkspaceBoard = WorkspaceBoard;

export type AgentStatus = "idle" | "thinking" | "ready" | "error";

export type BoardState = {
  projectId: string;
  workspace: Workspace;
  projectName: string;
  status: ProjectStatus;
  nodes: BoardNode[];
  edges: BoardEdge[];
  members: ApiAuthor[];
  agentStatus: AgentStatus;
  agentMessage?: string;
};

export { isCommentNode, isDocNode, isNoteNode };

export function documentFileUrl(projectId: string, docId: string) {
  return `/api/projects/${projectId}/documents/${docId}/file`;
}

function dedupeAuthors(authors: ApiAuthor[]) {
  const byId = new Map<string, ApiAuthor>();
  for (const author of authors) {
    if (!author.id || byId.has(author.id)) continue;
    byId.set(author.id, {
      id: author.id,
      name: author.name,
      image: author.image ?? null,
      kind: author.kind,
    });
  }
  return [...byId.values()];
}

export function toBoardState(
  board: Pick<WorkspaceBoard, "project" | "workspace" | "nodes" | "edges"> & {
    members?: ApiAuthor[];
  },
  prev?: BoardState | null,
) {
  return {
    projectId: board.project.id,
    workspace: {
      ...board.workspace,
      project: board.project,
    },
    projectName: board.project.name,
    status: board.project.status,
    nodes: board.nodes,
    edges: board.edges,
    members: dedupeAuthors(board.members ?? prev?.members ?? []),
    agentStatus: prev?.agentStatus ?? "idle",
    agentMessage: prev?.agentMessage,
  } satisfies BoardState;
}
