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

/**
 * One instance per projectId (via getByName).
 * D1 remains durable board storage; this DO is the realtime fan-out + presence layer.
 */
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

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected WebSocket", { status: 426 });
    }

    const url = new URL(request.url);
    const projectId = url.searchParams.get("projectId")?.trim();
    if (!projectId) {
      return new Response("projectId required", { status: 400 });
    }

    const board = await loadBoard(this.env.DB, projectId);
    if (!board) {
      return new Response("Project not found", { status: 404 });
    }

    this.rememberProjectId(projectId);

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
      projectId,
      seq: this.currentSeq(),
      snapshot: {
        project: board.project,
        nodes: board.nodes,
        edges: board.edges,
      },
      peers: this.listPeers().filter((p) => p.clientId !== clientId),
      you: toPeer(attachment),
    };
    server.send(JSON.stringify(ready));
    this.broadcastPresence(projectId);

    return new Response(null, { status: 101, webSocket: client });
  }

  /** Called by the API worker after a durable mutation lands in D1. */
  async publish(
    projectId: string,
    event: SyncEvent,
    originClientId: string | null = null,
  ): Promise<{ seq: number }> {
    this.rememberProjectId(projectId);
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
      projectId,
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

    const attachment = (ws.deserializeAttachment() ?? null) as Attachment | null;
    if (!attachment) {
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
      this.broadcastPresence(this.storedProjectId() ?? "");
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
      this.broadcastPresence(this.storedProjectId() ?? "");
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
      // already closed
    }
    this.broadcastPresence(this.storedProjectId() ?? "");
  }

  async webSocketError(ws: WebSocket, _error: unknown): Promise<void> {
    try {
      ws.close(1011, "error");
    } catch {
      // ignore
    }
    this.broadcastPresence(this.storedProjectId() ?? "");
  }

  private currentSeq(): number {
    const row = this.ctx.storage.sql
      .exec<{ value: string }>(`SELECT value FROM meta WHERE key = 'seq'`)
      .toArray()[0];
    return row ? Number(row.value) || 0 : 0;
  }

  private nextSeq(): number {
    const seq = this.currentSeq() + 1;
    this.ctx.storage.sql.exec(
      `INSERT INTO meta (key, value) VALUES ('seq', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      String(seq),
    );
    return seq;
  }

  private rememberProjectId(projectId: string): void {
    this.ctx.storage.sql.exec(
      `INSERT INTO meta (key, value) VALUES ('project_id', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      projectId,
    );
  }

  private storedProjectId(): string | null {
    const row = this.ctx.storage.sql
      .exec<{ value: string }>(`SELECT value FROM meta WHERE key = 'project_id'`)
      .toArray()[0];
    return row?.value ?? null;
  }

  private trimEventLog(): void {
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

  private listPeers(): SyncPeer[] {
    const peers: SyncPeer[] = [];
    const seen = new Set<string>();
    for (const ws of this.ctx.getWebSockets()) {
      const a = ws.deserializeAttachment() as Attachment | null;
      if (!a?.clientId || seen.has(a.clientId)) continue;
      seen.add(a.clientId);
      peers.push(toPeer(a));
    }
    return peers;
  }

  private broadcastPresence(projectId: string): void {
    if (!projectId) return;
    const message: ServerToClientMessage = {
      type: "presence",
      projectId,
      peers: this.listPeers(),
    };
    this.broadcast(JSON.stringify(message));
  }

  private broadcast(payload: string): void {
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(payload);
      } catch {
        // drop dead sockets
      }
    }
  }

  private send(ws: WebSocket, message: ServerToClientMessage): void {
    try {
      ws.send(JSON.stringify(message));
    } catch {
      // ignore
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
