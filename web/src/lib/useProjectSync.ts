"use client";

import { useEffect, useRef, useState } from "react";
import type { BoardState } from "./project-types";
import {
  applySyncEvent,
  getClientName,
  getOrCreateClientId,
  projectSyncWsUrl,
  snapshotToBoardState,
  type ClientToServerMessage,
  type ServerToClientMessage,
  type SyncPeer,
} from "./sync-protocol";

type Options = {
  projectId: string;
  enabled?: boolean;
  onBoard: (updater: (prev: BoardState | null) => BoardState | null) => void;
  /** Skip applying events that originated from this tab (optimistic already applied). */
  skipOwnEvents?: boolean;
};

export type SyncConnectionStatus = "connecting" | "live" | "reconnecting" | "offline";

export function useProjectSync({
  projectId,
  enabled = true,
  onBoard,
  skipOwnEvents = true,
}: Options) {
  const [status, setStatus] = useState<SyncConnectionStatus>("connecting");
  const [peers, setPeers] = useState<SyncPeer[]>([]);
  const [clientId] = useState(() => getOrCreateClientId());
  const wsRef = useRef<WebSocket | null>(null);
  const onBoardRef = useRef(onBoard);
  const selectedIdRef = useRef<string | null>(null);
  const seqRef = useRef(0);

  useEffect(() => {
    onBoardRef.current = onBoard;
  }, [onBoard]);

  useEffect(() => {
    if (!enabled || !projectId) return;

    let closed = false;
    let retryMs = 800;
    let retryTimer: number | null = null;
    let pingTimer: number | null = null;

    const connect = () => {
      if (closed) return;
      setStatus((s) => (s === "live" ? "live" : "connecting"));

      const ws = new WebSocket(
        projectSyncWsUrl(projectId, {
          clientId,
          name: getClientName(),
        }),
      );
      wsRef.current = ws;

      ws.onopen = () => {
        retryMs = 800;
        setStatus("live");
        const hello: ClientToServerMessage = {
          type: "hello",
          clientId,
          name: getClientName(),
        };
        ws.send(JSON.stringify(hello));
        pingTimer = window.setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "ping" } satisfies ClientToServerMessage));
          }
        }, 25_000);
      };

      ws.onmessage = (ev) => {
        let msg: ServerToClientMessage;
        try {
          msg = JSON.parse(String(ev.data)) as ServerToClientMessage;
        } catch {
          return;
        }

        if (msg.type === "ready") {
          seqRef.current = msg.seq;
          setPeers(msg.peers.filter((p) => p.clientId !== clientId));
          onBoardRef.current((prev) => snapshotToBoardState(msg.snapshot, prev));
          return;
        }

        if (msg.type === "event") {
          if (msg.seq <= seqRef.current) return;
          seqRef.current = msg.seq;
          if (skipOwnEvents && msg.originClientId === clientId) return;
          onBoardRef.current((prev) => {
            if (!prev) return prev;
            return applySyncEvent(prev, msg.event);
          });
          return;
        }

        if (msg.type === "presence") {
          setPeers(msg.peers.filter((p) => p.clientId !== clientId));
          return;
        }
      };

      ws.onclose = () => {
        if (pingTimer != null) window.clearInterval(pingTimer);
        pingTimer = null;
        wsRef.current = null;
        if (closed) return;
        setStatus("reconnecting");
        retryTimer = window.setTimeout(() => {
          retryMs = Math.min(retryMs * 1.6, 8_000);
          connect();
        }, retryMs);
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    connect();

    return () => {
      closed = true;
      if (retryTimer != null) window.clearTimeout(retryTimer);
      if (pingTimer != null) window.clearInterval(pingTimer);
      wsRef.current?.close();
      wsRef.current = null;
      setStatus("offline");
      setPeers([]);
    };
  }, [clientId, enabled, projectId, skipOwnEvents]);

  const publishPresence = (selectedId: string | null) => {
    selectedIdRef.current = selectedId;
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const msg: ClientToServerMessage = {
      type: "presence",
      selectedId,
    };
    ws.send(JSON.stringify(msg));
  };

  return { status, peers, clientId, publishPresence };
}
