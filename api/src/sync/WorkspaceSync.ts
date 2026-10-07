import { DurableObject } from "cloudflare:workers";
import {
  colorForClientId,
  loadBoard,
  parseClientMessage,
  type ServerToClientMessage,
  type SyncEvent,
  type SyncPeer,
} from "@lyzyos/db";

type Attachment = {
  clientId: string;
  name: string;
  color: string;
  selectedId?: string;
  cursor?: { x: number; y: number };
  joinedAt: number;
};

const MAX_EVENT_LOG = 200;

function isAttachment(value: unknown): value is Attachment {
  if (typeof value !== "object" || value === null) return false;
  if (!("clientId" in value) || !("name" in value) || !("color" in value) || !("joinedAt" in value)) {
    return false;
  }
  return (
    typeof value.clientId === "string" &&
    typeof value.name === "string" &&
    typeof value.color === "string" &&
    typeof value.joinedAt === "number"
  );
}

export class WorkspaceSync extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.ctx.blockConcurrencyWhile(async () => {
      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS meta (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS events (
          seq INTEGER PRIMARY KEY,
          origin_client_id TEXT,
          payload TEXT NOT NULL,
          created_at INTEGER NOT NULL
        );
      `);
    });
  }

  async fetch(request: Request) {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected WebSocket", { status: 426 });
    }

    const url = new URL(request.url);
    const workspaceId = url.searchParams.get("workspaceId")?.trim();
    if (!workspaceId) {
      return new Response("workspaceId required", { status: 400 });
    }

    const board = await loadBoard(this.env.DB, workspaceId, this.env.AGENT_ID);
    if (!board) {
      return new Response("Workspace not found", { status: 404 });
    }

    this.rememberWorkspace(workspaceId, board.project.id);

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);

    const clientId = url.searchParams.get("clientId")?.trim() || crypto.randomUUID();
    const name = url.searchParams.get("name")?.trim().slice(0, 40) || "Collaborator";
    const color = url.searchParams.get("color")?.trim() || colorForClientId(clientId);

    const attachment: Attachment = {
      clientId,
      name,
      color,
      joinedAt: Date.now(),
    };
    server.serializeAttachment(attachment);

    const ready: ServerToClientMessage = {
      type: "ready",
      workspaceId,
      projectId: board.project.id,
      seq: this.currentSeq(),
      snapshot: {
        project: board.project,
        workspace: board.workspace,
        nodes: board.nodes,
        edges: board.edges,
      },
      peers: this.listPeers().filter((p) => p.clientId !== clientId),
      you: toPeer(attachment),
    };
    server.send(JSON.stringify(ready));
    this.broadcastPresence(workspaceId, board.project.id);

    return new Response(null, { status: 101, webSocket: client });
  }

  async publish(workspaceId: string, event: SyncEvent, originClientId: string | null = null) {
    const projectId = this.storedProjectId() ?? "";
    this.rememberWorkspace(workspaceId, projectId || undefined);
    const seq = this.nextSeq();
    const createdAt = Date.now();
    this.ctx.storage.sql.exec(
      `INSERT INTO events (seq, origin_client_id, payload, created_at) VALUES (?, ?, ?, ?)`,
      seq,
      originClientId,
      JSON.stringify(event),
      createdAt,
    );
    this.trimEventLog();

    const message: ServerToClientMessage = {
      type: "event",
      workspaceId,
      projectId: this.storedProjectId() ?? projectId,
      seq,
      originClientId,
      event,
    };
    this.broadcast(JSON.stringify(message));
    return { seq };
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (typeof message !== "string") return;
    const parsed = parseClientMessage(message);
    if (!parsed) {
      this.send(ws, { type: "error", message: "Invalid message." });
      return;
    }

    const attachment = ws.deserializeAttachment() ?? null;
    if (!isAttachment(attachment)) {
      this.send(ws, { type: "error", message: "Session not initialized." });
      return;
    }

    if (parsed.type === "ping") {
      this.send(ws, { type: "pong" });
      return;
    }

    if (parsed.type === "hello") {
      attachment.clientId = parsed.clientId.trim() || attachment.clientId;
      attachment.name = parsed.name.trim().slice(0, 40) || attachment.name;
      attachment.color = parsed.color?.trim() || colorForClientId(attachment.clientId);
      ws.serializeAttachment(attachment);
      this.broadcastPresence(this.storedWorkspaceId() ?? "", this.storedProjectId() ?? "");
      return;
    }

    if (parsed.type === "presence") {
      if (parsed.selectedId === null) delete attachment.selectedId;
      else if (typeof parsed.selectedId === "string") {
        attachment.selectedId = parsed.selectedId;
      }
      if (parsed.cursor === null) delete attachment.cursor;
      else if (parsed.cursor && typeof parsed.cursor.x === "number") {
        attachment.cursor = parsed.cursor;
      }
      ws.serializeAttachment(attachment);
      this.broadcastPresence(this.storedWorkspaceId() ?? "", this.storedProjectId() ?? "");
    }
  }

  async webSocketClose(
    ws: WebSocket,
    code: number,
    reason: string,
    _wasClean: boolean,
  ): Promise<void> {
    try {
      ws.close(code, reason);
    } catch {
    }
    this.broadcastPresence(this.storedWorkspaceId() ?? "", this.storedProjectId() ?? "");
  }

  async webSocketError(ws: WebSocket, _error: unknown): Promise<void> {
    try {
      ws.close(1011, "error");
    } catch {
    }
    this.broadcastPresence(this.storedWorkspaceId() ?? "", this.storedProjectId() ?? "");
  }

  private currentSeq() {
    const row = this.ctx.storage.sql
      .exec<{ value: string }>(`SELECT value FROM meta WHERE key = 'seq'`)
      .toArray()[0];
    return row ? Number(row.value) || 0 : 0;
  }

  private nextSeq() {
    const seq = this.currentSeq() + 1;
    this.ctx.storage.sql.exec(
      `INSERT INTO meta (key, value) VALUES ('seq', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      String(seq),
    );
    return seq;
  }

  private rememberWorkspace(workspaceId: string, projectId?: string) {
    this.ctx.storage.sql.exec(
      `INSERT INTO meta (key, value) VALUES ('workspace_id', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      workspaceId,
    );
    if (projectId) {
      this.ctx.storage.sql.exec(
        `INSERT INTO meta (key, value) VALUES ('project_id', ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        projectId,
      );
    }
  }

  private storedWorkspaceId() {
    const row = this.ctx.storage.sql
      .exec<{ value: string }>(`SELECT value FROM meta WHERE key = 'workspace_id'`)
      .toArray()[0];
    return row?.value ?? null;
  }

  private storedProjectId() {
    const row = this.ctx.storage.sql
      .exec<{ value: string }>(`SELECT value FROM meta WHERE key = 'project_id'`)
      .toArray()[0];
    return row?.value ?? null;
  }

  private trimEventLog() {
    const count = this.ctx.storage.sql
      .exec<{ c: number }>(`SELECT COUNT(*) AS c FROM events`)
      .one().c;
    if (count <= MAX_EVENT_LOG) return;
    const drop = count - MAX_EVENT_LOG;
    this.ctx.storage.sql.exec(
      `DELETE FROM events WHERE seq IN (
         SELECT seq FROM events ORDER BY seq ASC LIMIT ?
       )`,
      drop,
    );
  }

  private listPeers() {
    const peers: SyncPeer[] = [];
    const seen = new Set<string>();
    for (const ws of this.ctx.getWebSockets()) {
      const a = ws.deserializeAttachment();
      if (!isAttachment(a) || seen.has(a.clientId)) continue;
      seen.add(a.clientId);
      peers.push(toPeer(a));
    }
    return peers;
  }

  private broadcastPresence(workspaceId: string, projectId: string) {
    if (!workspaceId) return;
    const message: ServerToClientMessage = {
      type: "presence",
      workspaceId,
      projectId,
      peers: this.listPeers(),
    };
    this.broadcast(JSON.stringify(message));
  }

  private broadcast(payload: string) {
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(payload);
      } catch {
      }
    }
  }

  private send(ws: WebSocket, message: ServerToClientMessage) {
    try {
      ws.send(JSON.stringify(message));
    } catch {
    }
  }
}

function toPeer(a: Attachment): SyncPeer {
  return {
    clientId: a.clientId,
    name: a.name,
    color: a.color,
    selectedId: a.selectedId,
    cursor: a.cursor,
    joinedAt: a.joinedAt,
  };
}
