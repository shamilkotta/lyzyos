import {
  parseServerMessage,
  type BoardSnapshot,
  type ClientToServerMessage,
  type ServerToClientMessage,
  type SyncEvent,
  type SyncPeer,
} from "@lyzyos/db";
import type { BoardState } from "./project-types";
import { toBoardState } from "./project-types";

export type { BoardSnapshot, ClientToServerMessage, ServerToClientMessage, SyncEvent, SyncPeer };
export { parseServerMessage };

export const CLIENT_ID_HEADER = "X-Client-Id";
const CLIENT_ID_KEY = "lyzy.clientId";
const CLIENT_NAME_KEY = "lyzy.clientName";

export function getOrCreateClientId() {
  if (typeof window === "undefined") return crypto.randomUUID();
  const existing = window.localStorage.getItem(CLIENT_ID_KEY);
  if (existing) return existing;
  const id = crypto.randomUUID();
  window.localStorage.setItem(CLIENT_ID_KEY, id);
  return id;
}

export function getClientName() {
  if (typeof window === "undefined") return "You";
  return window.localStorage.getItem(CLIENT_NAME_KEY) || "You";
}

export function applySyncEvent(board: BoardState, event: SyncEvent) {
  switch (event.type) {
    case "board.replace":
      return toBoardState(event.board, board);
    case "project.updated":
      return {
        ...board,
        projectId: event.project.id,
        projectName: event.project.name,
        status: event.project.status,
      };
    case "workspace.updated":
      return {
        ...board,
        workspace: { ...board.workspace, ...event.workspace },
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
    default: {
      const _exhaustive: never = event;
      return _exhaustive;
    }
  }
}

export function snapshotToBoardState(snapshot: BoardSnapshot, prev?: BoardState | null) {
  return toBoardState(snapshot, prev);
}

export function workspaceSyncWsUrl(
  workspaceId: string,
  params: { clientId: string; name: string },
) {
  const base = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
  const url = new URL(`/api/workspaces/${workspaceId}/sync`, base);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.searchParams.set("clientId", params.clientId);
  url.searchParams.set("name", params.name);
  return url.toString();
}
