"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { BoardState } from "./project-types";
import { toBoardState } from "./project-types";
import {
  applySyncEvent,
  getClientName,
  getOrCreateClientId,
  parseServerMessage,
  workspaceSyncWsUrl,
  type ClientToServerMessage,
  type SyncPeer,
} from "./sync-protocol";

type Options = {
  /** Canonical workspace id (not a slug). Sync stays idle while null. */
  workspaceId: string | null;
  onBoard: (updater: (prev: BoardState | null) => BoardState | null) => void;
};

export type SyncConnectionStatus = "connecting" | "live" | "reconnecting" | "offline";

const RETRY_MIN_MS = 800;
const RETRY_MAX_MS = 8_000;
const PING_MS = 25_000;

async function fetchSyncToken(workspaceId: string) {
  const res = await fetch(`/api/workspaces/${workspaceId}/sync-token`, { method: "POST" });
  if (!res.ok) throw new Error(`sync token → ${res.status}`);
  const body = (await res.json()) as { data?: { token?: string } };
  if (!body.data?.token) throw new Error("sync token missing");
  return body.data.token;
}

/**
 * Keeps a websocket to the workspace's sync room: applies remote board events (skipping echoes of
 * this client's own writes, which are already applied optimistically) and tracks peer presence.
 */
export function useProjectSync({ workspaceId, onBoard }: Options) {
  const [status, setStatus] = useState<SyncConnectionStatus>("connecting");
  const [peers, setPeers] = useState<SyncPeer[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const onBoardRef = useRef(onBoard);

  useEffect(() => {
    onBoardRef.current = onBoard;
  }, [onBoard]);

  useEffect(() => {
    if (!workspaceId) return;

    const clientId = getOrCreateClientId();
    let disposed = false;
    let retryMs = RETRY_MIN_MS;
    let retryTimer: number | undefined;
    let pingTimer: number | undefined;
    let lastSeq = 0;

    const scheduleReconnect = () => {
      if (disposed) return;
      setStatus("reconnecting");
      retryTimer = window.setTimeout(connect, retryMs);
      retryMs = Math.min(retryMs * 1.6, RETRY_MAX_MS);
    };

    const onMessage = (ev: MessageEvent) => {
      const msg = parseServerMessage(String(ev.data));
      if (!msg) return;
      switch (msg.type) {
        case "ready":
          lastSeq = msg.seq;
          setPeers(msg.peers.filter((p) => p.clientId !== clientId));
          onBoardRef.current((prev) => toBoardState(msg.snapshot, prev));
          return;
        case "event":
          if (msg.seq <= lastSeq) return;
          lastSeq = msg.seq;
          if (msg.originClientId === clientId) return;
          onBoardRef.current((prev) => (prev ? applySyncEvent(prev, msg.event) : prev));
          return;
        case "presence":
          setPeers(msg.peers.filter((p) => p.clientId !== clientId));
          return;
      }
    };

    async function connect() {
      let token: string;
      try {
        token = await fetchSyncToken(workspaceId!);
      } catch {
        scheduleReconnect();
        return;
      }
      // The effect may have been torn down while the token was in flight.
      if (disposed) return;

      const name = getClientName();
      const ws = new WebSocket(workspaceSyncWsUrl(workspaceId!, { clientId, name, token }));
      wsRef.current = ws;

      ws.onopen = () => {
        retryMs = RETRY_MIN_MS;
        setStatus("live");
        ws.send(JSON.stringify({ type: "hello", clientId, name } satisfies ClientToServerMessage));
        pingTimer = window.setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "ping" } satisfies ClientToServerMessage));
          }
        }, PING_MS);
      };
      ws.onmessage = onMessage;
      ws.onerror = () => ws.close();
      ws.onclose = () => {
        window.clearInterval(pingTimer);
        if (wsRef.current === ws) wsRef.current = null;
        scheduleReconnect();
      };
    }

    void connect();

    return () => {
      disposed = true;
      window.clearTimeout(retryTimer);
      window.clearInterval(pingTimer);
      wsRef.current?.close();
      wsRef.current = null;
      setStatus("offline");
      setPeers([]);
    };
  }, [workspaceId]);

  const publishPresence = useCallback((selectedId: string | null) => {
    const ws = wsRef.current;
    if (ws?.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: "presence", selectedId } satisfies ClientToServerMessage));
  }, []);

  return { status, peers, publishPresence };
}
