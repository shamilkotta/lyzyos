import { z } from "zod";
import {
  boardEdgeSchema,
  memberPreviewSchema,
  nodeDtoSchema,
  projectDtoSchema,
  workspaceDtoSchema,
} from "./types";

export const boardSnapshotSchema = z.object({
  project: projectDtoSchema,
  workspace: workspaceDtoSchema,
  nodes: z.array(nodeDtoSchema),
  edges: z.array(boardEdgeSchema),
});
export type BoardSnapshot = z.infer<typeof boardSnapshotSchema>;

const pointSchema = z.object({ x: z.number(), y: z.number() }).strict();

export const syncPeerSchema = z.object({
  clientId: z.string(),
  name: z.string(),
  color: z.string(),
  selectedId: z.string().optional(),
  cursor: pointSchema.optional(),
  joinedAt: z.number(),
});
export type SyncPeer = z.infer<typeof syncPeerSchema>;

export const syncEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("board.replace"), board: boardSnapshotSchema }),
  z.object({ type: z.literal("project.updated"), project: projectDtoSchema }),
  z.object({ type: z.literal("workspace.updated"), workspace: workspaceDtoSchema }),
  z.object({ type: z.literal("node.upserted"), node: nodeDtoSchema }),
  z.object({ type: z.literal("node.removed"), nodeId: z.string() }),
  z.object({ type: z.literal("edge.upserted"), edge: boardEdgeSchema }),
  z.object({ type: z.literal("edge.removed"), edgeId: z.string() }),
]);
export type SyncEvent = z.infer<typeof syncEventSchema>;

export const clientToServerMessageSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("hello"),
      clientId: z.string().min(1),
      name: z.string().min(1),
      color: z.string().optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("presence"),
      selectedId: z.string().nullable().optional(),
      cursor: pointSchema.nullable().optional(),
    })
    .strict(),
  z.object({ type: z.literal("ping") }).strict(),
]);
export type ClientToServerMessage = z.infer<typeof clientToServerMessageSchema>;

export const serverToClientMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("ready"),
    workspaceId: z.string(),
    projectId: z.string(),
    seq: z.number(),
    snapshot: boardSnapshotSchema,
    peers: z.array(syncPeerSchema),
    you: syncPeerSchema,
  }),
  z.object({
    type: z.literal("event"),
    workspaceId: z.string(),
    projectId: z.string(),
    seq: z.number(),
    originClientId: z.string().nullable(),
    event: syncEventSchema,
  }),
  z.object({
    type: z.literal("presence"),
    workspaceId: z.string(),
    projectId: z.string(),
    peers: z.array(syncPeerSchema),
  }),
  z.object({ type: z.literal("pong") }),
  z.object({ type: z.literal("error"), message: z.string() }),
]);
export type ServerToClientMessage = z.infer<typeof serverToClientMessageSchema>;

export const workspaceBoardSchema = boardSnapshotSchema.extend({
  members: z.array(memberPreviewSchema),
});
export type WorkspaceBoard = z.infer<typeof workspaceBoardSchema>;

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

export function colorForClientId(clientId: string) {
  let hash = 0;
  for (let i = 0; i < clientId.length; i += 1) {
    hash = (hash * 31 + clientId.charCodeAt(i)) >>> 0;
  }
  return PEER_COLORS[hash % PEER_COLORS.length] ?? PEER_COLORS[0];
}

export function parseClientMessage(raw: string) {
  try {
    const result = clientToServerMessageSchema.safeParse(JSON.parse(raw));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

export function parseServerMessage(raw: string) {
  try {
    const result = serverToClientMessageSchema.safeParse(JSON.parse(raw));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
