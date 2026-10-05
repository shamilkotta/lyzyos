import type { BoardState, PlanningNodeDto, ProjectDto } from "./types";

/** Stable entity kinds — every record uses a UUID primary key. */
export const entityKinds = ["project", "document", "node", "edge", "client"] as const;

export type EntityKind = (typeof entityKinds)[number];

export type BoardSnapshot = {
  project: ProjectDto;
  nodes: PlanningNodeDto[];
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

/** Durable board mutations fan out through WorkspaceSync. */
export type SyncEvent =
  | { type: "board.replace"; board: BoardSnapshot }
  | { type: "project.updated"; project: ProjectDto }
  | { type: "node.upserted"; node: PlanningNodeDto }
  | { type: "node.removed"; nodeId: string }
  | { type: "edge.upserted"; edge: { id: string; sourceId: string; targetId: string } }
  | { type: "edge.removed"; edgeId: string };

export type ClientToServerMessage =
  | { type: "hello"; clientId: string; name: string; color?: string }
  | {
      type: "presence";
      selectedId?: string | null;
      cursor?: { x: number; y: number } | null;
    }
  | { type: "ping" };

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

export const CLIENT_ID_HEADER = "X-Client-Id";

const PEER_COLORS = [
  "#3d5a40",
  "#5c4a3a",
  "#3a4a5c",
  "#5c3a4a",
  "#4a5c3a",
  "#3a5c5c",
  "#5c5c3a",
  "#4a3a5c",
];

export function colorForClientId(clientId: string): string {
  let hash = 0;
  for (let i = 0; i < clientId.length; i += 1) {
    hash = (hash * 31 + clientId.charCodeAt(i)) >>> 0;
  }
  return PEER_COLORS[hash % PEER_COLORS.length] ?? PEER_COLORS[0];
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
      if (idx === -1) {
        return { ...board, nodes: [...board.nodes, event.node] };
      }
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
      return {
        ...board,
        edges: board.edges.filter((e) => e.id !== event.edgeId),
      };
    default:
      return board;
  }
}

export function snapshotToBoardState(snapshot: BoardSnapshot): BoardState {
  return {
    projectId: snapshot.project.id,
    projectName: snapshot.project.name,
    planningStatus: snapshot.project.planningStatus,
    threadId: snapshot.project.threadId,
    nodes: snapshot.nodes,
    edges: snapshot.edges,
    agentStatus: "idle",
  };
}

export function parseClientMessage(raw: string): ClientToServerMessage | null {
  try {
    const data = JSON.parse(raw) as ClientToServerMessage;
    if (!data || typeof data !== "object" || !("type" in data)) return null;
    return data;
  } catch {
    return null;
  }
}
