import type { BoardState, PlanningNode, Project } from "./project-types";

export type BoardSnapshot = {
  project: Project;
  nodes: PlanningNode[];
  edges: { id: string; sourceId: string; targetId: string }[];
};

export type SyncPeer = {
  clientId: string;
  name: string;
  color: string;
  selectedId?: string;
  cursor?: { x: number; y: number };
  joinedAt: number;
};

export type SyncEvent =
  | { type: "board.replace"; board: BoardSnapshot }
  | { type: "project.updated"; project: Project }
  | { type: "node.upserted"; node: PlanningNode }
  | { type: "node.removed"; nodeId: string }
  | { type: "edge.upserted"; edge: { id: string; sourceId: string; targetId: string } }
  | { type: "edge.removed"; edgeId: string };

export type ServerToClientMessage =
  | {
      type: "ready";
      projectId: string;
      seq: number;
      snapshot: BoardSnapshot;
      peers: SyncPeer[];
      you: SyncPeer;
    }
  | {
      type: "event";
      projectId: string;
      seq: number;
      originClientId: string | null;
      event: SyncEvent;
    }
  | { type: "presence"; projectId: string; peers: SyncPeer[] }
  | { type: "pong" }
  | { type: "error"; message: string };

export type ClientToServerMessage =
  | { type: "hello"; clientId: string; name: string; color?: string }
  | {
      type: "presence";
      selectedId?: string | null;
      cursor?: { x: number; y: number } | null;
    }
  | { type: "ping" };

export const CLIENT_ID_HEADER = "X-Client-Id";
const CLIENT_ID_KEY = "lyzy.clientId";
const CLIENT_NAME_KEY = "lyzy.clientName";

export function getOrCreateClientId(): string {
  if (typeof window === "undefined") return crypto.randomUUID();
  const existing = window.localStorage.getItem(CLIENT_ID_KEY);
  if (existing) return existing;
  const id = crypto.randomUUID();
  window.localStorage.setItem(CLIENT_ID_KEY, id);
  return id;
}

export function getClientName(): string {
  if (typeof window === "undefined") return "You";
  return window.localStorage.getItem(CLIENT_NAME_KEY) || "You";
}

export function applySyncEvent(board: BoardState, event: SyncEvent): BoardState {
  switch (event.type) {
    case "board.replace":
      return {
        ...board,
        projectId: event.board.project.id,
        projectName: event.board.project.name,
        planningStatus: event.board.project.planningStatus,
        threadId: event.board.project.threadId,
        nodes: event.board.nodes,
        edges: event.board.edges,
      };
    case "project.updated":
      return {
        ...board,
        projectId: event.project.id,
        projectName: event.project.name,
        planningStatus: event.project.planningStatus,
        threadId: event.project.threadId,
      };
    case "node.upserted": {
      const idx = board.nodes.findIndex((n) => n.id === event.node.id);
      if (idx === -1) return { ...board, nodes: [...board.nodes, event.node] };
      const nodes = board.nodes.slice();
      nodes[idx] = event.node;
      return { ...board, nodes };
    }
    case "node.removed":
      return {
        ...board,
        nodes: board.nodes.filter((n) => n.id !== event.nodeId),
        edges: board.edges.filter(
          (e) => e.sourceId !== event.nodeId && e.targetId !== event.nodeId,
        ),
      };
    case "edge.upserted": {
      const idx = board.edges.findIndex((e) => e.id === event.edge.id);
      if (idx === -1) {
        const dup = board.edges.some(
          (e) => e.sourceId === event.edge.sourceId && e.targetId === event.edge.targetId,
        );
        if (dup) return board;
        return { ...board, edges: [...board.edges, event.edge] };
      }
      const edges = board.edges.slice();
      edges[idx] = event.edge;
      return { ...board, edges };
    }
    case "edge.removed":
      return { ...board, edges: board.edges.filter((e) => e.id !== event.edgeId) };
    default:
      return board;
  }
}

export function snapshotToBoardState(
  snapshot: BoardSnapshot,
  prev?: BoardState | null,
): BoardState {
  return {
    projectId: snapshot.project.id,
    projectName: snapshot.project.name,
    planningStatus: snapshot.project.planningStatus,
    threadId: snapshot.project.threadId,
    nodes: snapshot.nodes,
    edges: snapshot.edges,
    agentStatus: prev?.agentStatus ?? "idle",
    agentMessage: prev?.agentMessage,
  };
}

/** Direct to API worker — Next rewrites do not proxy WebSocket upgrades. */
export function projectSyncWsUrl(
  projectId: string,
  params: { clientId: string; name: string },
): string {
  const httpBase =
    process.env.NEXT_PUBLIC_API_BASE ||
    process.env.NEXT_PUBLIC_API_WS_BASE ||
    "http://127.0.0.1:8788";
  const url = new URL(`/api/projects/${projectId}/sync`, httpBase);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.searchParams.set("clientId", params.clientId);
  url.searchParams.set("name", params.name);
  return url.toString();
}
