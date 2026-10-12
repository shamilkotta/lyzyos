import {
  isCommentNode,
  isDocNode,
  type BoardEdge,
  type CommentNodeDto,
  type DocNodeDto,
  type MemberPreview,
  type NodeDto,
  type ProjectDto,
  type WorkspaceBoard,
  type WorkspaceDto,
} from "@lyzyos/db";

export type { BoardEdge, CommentNodeDto, DocNodeDto };
export type BoardNode = NodeDto;
export type Project = ProjectDto;
export type Workspace = WorkspaceDto & { project?: Project };

export type BoardState = {
  projectId: string;
  workspace: Workspace;
  projectName: string;
  status: Project["status"];
  nodes: BoardNode[];
  edges: BoardEdge[];
  members: MemberPreview[];
};

export { isCommentNode, isDocNode };

export function documentFileUrl(projectId: string, docId: string) {
  return `/api/projects/${projectId}/documents/${docId}/file`;
}

function dedupeMembers(members: MemberPreview[]) {
  const byId = new Map<string, MemberPreview>();
  for (const member of members) {
    if (!member.id || byId.has(member.id)) continue;
    byId.set(member.id, { ...member, image: member.image ?? null });
  }
  return [...byId.values()];
}

/** Normalizes a REST board or sync snapshot. Snapshots carry no roster, so keep the previous one. */
export function toBoardState(
  board: Pick<WorkspaceBoard, "project" | "workspace" | "nodes" | "edges"> & {
    members?: MemberPreview[];
  },
  prev?: BoardState | null,
): BoardState {
  return {
    projectId: board.project.id,
    workspace: { ...board.workspace, project: board.project },
    projectName: board.project.name,
    status: board.project.status,
    nodes: board.nodes,
    edges: board.edges,
    members: dedupeMembers(board.members ?? prev?.members ?? []),
  };
}
