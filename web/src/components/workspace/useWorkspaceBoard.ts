"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MemberPreview } from "@lyzyos/db";
import {
  createProjectEdge,
  deleteProjectEdge,
  deleteProjectNode,
  placeProjectNode,
  replyToCommentThread,
  updateProjectNode,
} from "@/lib/api";
import { useDebouncedCallback } from "@/lib/debounce";
import { isCommentNode, type BoardNode, type BoardState } from "@/lib/project-types";
import { useProjectBoard } from "@/lib/queries/projects";
import { useProjectSync } from "@/lib/useProjectSync";

const POSITION_SAVE_MS = 450;
/** Offset between documents dropped in one upload so they don't stack exactly. */
const UPLOAD_CASCADE_PX = 32;
const OPTIMISTIC_PREFIX = "optimistic-";

export function isOptimisticId(id: string) {
  return id.startsWith(OPTIMISTIC_PREFIX);
}

type Point = { x: number; y: number };
type Author = { id: string; name: string } | null;

function errorText(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function replaceNode(board: BoardState, id: string, node: BoardNode): BoardState {
  return { ...board, nodes: board.nodes.map((n) => (n.id === id ? node : n)) };
}

/**
 * Owns a workspace board: the REST snapshot, live sync updates, and optimistic local edits.
 *
 * Local edits are applied immediately and then persisted. Until the server confirms them, a few
 * refs remember what is in flight (deleted ids, unsaved positions, optimistic nodes) so a sync
 * snapshot or refetch landing mid-flight cannot resurrect or move things back.
 */
export function useWorkspaceBoard(args: {
  projectId: string;
  routeWorkspaceId: string;
  author: Author;
  /** An optimistic node was confirmed and now has its real id. */
  onNodeConfirmed: (optimisticId: string, realId: string) => void;
}) {
  const { projectId, routeWorkspaceId } = args;
  const { data: fetched, error: loadError, refetch } = useProjectBoard(projectId, routeWorkspaceId);
  const [local, setLocal] = useState<BoardState | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Sync snapshots carry nodes/edges only; the roster comes from REST and may land later.
  const board = useMemo(() => {
    if (!local) return fetched ?? null;
    if (local.members.length === 0 && fetched?.members.length) {
      return { ...local, members: fetched.members };
    }
    return local;
  }, [local, fetched]);

  const boardRef = useRef(board);
  const argsRef = useRef(args);
  useEffect(() => {
    boardRef.current = board;
    argsRef.current = args;
  });

  const removedNodeIds = useRef(new Set<string>());
  const removedEdgeIds = useRef(new Set<string>());
  const pendingPositions = useRef(new Map<string, Point>());
  /** Optimistic nodes/edges deleted before their create call returned (not pruned by `reconcile`). */
  const discardedOptimistic = useRef(new Set<string>());

  // The API accepts slugs, but the sync room is keyed by the canonical id.
  const workspaceId = board?.workspace.id ?? routeWorkspaceId;

  const update = useCallback((fn: (board: BoardState) => BoardState) => {
    setLocal((prev) => {
      const base = prev ?? boardRef.current;
      return base ? fn(base) : prev;
    });
  }, []);

  /** Re-applies in-flight local edits on top of a board that came from the server. */
  const reconcile = useCallback((next: BoardState, prev: BoardState | null): BoardState => {
    const removedNodes = removedNodeIds.current;
    const removedEdges = removedEdgeIds.current;
    const positions = pendingPositions.current;
    const serverNodeIds = new Set(next.nodes.map((n) => n.id));
    const serverEdgeIds = new Set(next.edges.map((e) => e.id));

    // Once the server no longer has a deleted item, stop tracking it.
    for (const id of removedNodes) if (!serverNodeIds.has(id)) removedNodes.delete(id);
    for (const id of removedEdges) if (!serverEdgeIds.has(id)) removedEdges.delete(id);

    const nodes = next.nodes
      .filter((n) => !removedNodes.has(n.id))
      .map((n) => {
        const pos = positions.get(n.id);
        return pos ? { ...n, x: pos.x, y: pos.y } : n;
      });
    const optimistic = prev?.nodes.filter((n) => isOptimisticId(n.id)) ?? [];

    return {
      ...next,
      nodes: optimistic.length ? [...nodes, ...optimistic] : nodes,
      edges: next.edges.filter((e) => !removedEdges.has(e.id)),
    };
  }, []);

  const applyRemote = useCallback(
    (updater: (prev: BoardState | null) => BoardState | null) => {
      setLocal((prev) => {
        const base = prev ?? boardRef.current;
        const next = updater(base);
        return next ? reconcile(next, base) : next;
      });
    },
    [reconcile],
  );

  const reload = useCallback(async () => {
    const { data } = await refetch();
    if (data) setLocal((prev) => reconcile(data, prev));
  }, [reconcile, refetch]);

  const fail = useCallback(
    (error: unknown, fallback: string) => {
      setActionError(errorText(error, fallback));
      void reload();
    },
    [reload],
  );

  const sync = useProjectSync({ workspaceId: board?.workspace.id ?? null, onBoard: applyRemote });

  // --- positions: debounced, batched ---------------------------------------------------------

  const flushPositions = useCallback(() => {
    for (const [id, pos] of pendingPositions.current) {
      if (isOptimisticId(id)) continue; // saved once the node exists
      pendingPositions.current.delete(id);
      updateProjectNode(projectId, workspaceId, id, pos).catch(() => {
        // Keep the local position and retry with the next move.
        if (!pendingPositions.current.has(id)) pendingPositions.current.set(id, pos);
      });
    }
  }, [projectId, workspaceId]);
  const savePositions = useDebouncedCallback(flushPositions, POSITION_SAVE_MS);

  const moveNode = useCallback(
    (id: string, position: Point) => {
      update((b) => ({
        ...b,
        nodes: b.nodes.map((n) => (n.id === id ? { ...n, ...position } : n)),
      }));
      pendingPositions.current.set(id, position);
      savePositions.schedule();
    },
    [savePositions, update],
  );

  // --- edges ----------------------------------------------------------------------------------

  const linkNodes = useCallback(
    (link: { sourceId: string; targetId: string }) => {
      const exists = (b: BoardState | null) =>
        b?.edges.some((e) => e.sourceId === link.sourceId && e.targetId === link.targetId);
      if (exists(boardRef.current)) return;

      const optimisticId = `${OPTIMISTIC_PREFIX}${crypto.randomUUID()}`;
      update((b) => (exists(b) ? b : { ...b, edges: [...b.edges, { id: optimisticId, ...link }] }));

      createProjectEdge(projectId, workspaceId, link)
        .then((edge) => {
          if (discardedOptimistic.current.delete(optimisticId)) {
            void deleteProjectEdge(projectId, workspaceId, edge.id).catch(() => undefined);
            return;
          }
          update((b) => ({
            ...b,
            edges: b.edges.map((e) =>
              e.id === optimisticId
                ? { id: edge.id, sourceId: edge.sourceId, targetId: edge.targetId }
                : e,
            ),
          }));
        })
        .catch((error: unknown) => {
          discardedOptimistic.current.delete(optimisticId);
          update((b) => ({ ...b, edges: b.edges.filter((e) => e.id !== optimisticId) }));
          setActionError(errorText(error, "Could not connect those cards."));
        });
    },
    [projectId, update, workspaceId],
  );

  const unlinkEdge = useCallback(
    (edgeId: string) => {
      if (!boardRef.current?.edges.some((e) => e.id === edgeId)) return;
      update((b) => ({ ...b, edges: b.edges.filter((e) => e.id !== edgeId) }));
      if (isOptimisticId(edgeId)) {
        discardedOptimistic.current.add(edgeId);
        return;
      }
      removedEdgeIds.current.add(edgeId);

      deleteProjectEdge(projectId, workspaceId, edgeId).catch((error: unknown) => {
        removedEdgeIds.current.delete(edgeId);
        fail(error, "Could not remove that connection.");
      });
    },
    [fail, projectId, update, workspaceId],
  );

  // --- nodes ----------------------------------------------------------------------------------

  const removeNode = useCallback(
    (nodeId: string) => {
      if (!boardRef.current?.nodes.some((n) => n.id === nodeId)) return;
      pendingPositions.current.delete(nodeId);
      if (isOptimisticId(nodeId)) discardedOptimistic.current.add(nodeId);
      else removedNodeIds.current.add(nodeId);
      update((b) => ({
        ...b,
        nodes: b.nodes.filter((n) => n.id !== nodeId),
        edges: b.edges.filter((e) => e.sourceId !== nodeId && e.targetId !== nodeId),
      }));
      // Optimistic nodes are deleted server-side once their create call returns.
      if (isOptimisticId(nodeId)) return;

      deleteProjectNode(projectId, workspaceId, nodeId).catch((error: unknown) => {
        removedNodeIds.current.delete(nodeId);
        fail(error, "Could not delete that card.");
      });
    },
    [fail, projectId, update, workspaceId],
  );

  /** Swaps an optimistic node for the server's, or cleans up if it was deleted meanwhile. */
  const confirmNode = useCallback(
    (optimisticId: string, node: BoardNode) => {
      if (discardedOptimistic.current.delete(optimisticId)) {
        void deleteProjectNode(projectId, workspaceId, node.id).catch(() => undefined);
        return;
      }
      const pos = pendingPositions.current.get(optimisticId);
      pendingPositions.current.delete(optimisticId);
      update((b) => replaceNode(b, optimisticId, pos ? { ...node, ...pos } : node));
      if (pos) moveNode(node.id, pos);
      argsRef.current.onNodeConfirmed(optimisticId, node.id);
    },
    [moveNode, projectId, update, workspaceId],
  );

  /** Places an empty note or comment thread; returns the optimistic id to select right away. */
  const placeNode = useCallback(
    (kind: "note" | "comment", position: Point) => {
      const { author } = argsRef.current;
      const now = Date.now();
      const id = `${OPTIMISTIC_PREFIX}${crypto.randomUUID()}`;
      const common = {
        id,
        workspaceId,
        title: kind === "note" ? "Untitled note" : "",
        body: "",
        authorId: author?.id ?? "",
        authorKind: "human" as const,
        authorName: author?.name ?? "You",
        ...position,
        createdAt: now,
        updatedAt: now,
      };
      const optimistic: BoardNode =
        kind === "comment"
          ? { ...common, kind, replies: [], openAudience: null, status: null }
          : { ...common, kind };
      update((b) => ({ ...b, nodes: [...b.nodes, optimistic] }));

      placeProjectNode(projectId, workspaceId, { kind, title: common.title, data: "", ...position })
        .then((node) => {
          if (node) confirmNode(id, node);
          else throw new Error("The server did not return the new card.");
        })
        .catch((error: unknown) => {
          discardedOptimistic.current.delete(id);
          update((b) => ({ ...b, nodes: b.nodes.filter((n) => n.id !== id) }));
          setActionError(errorText(error, "Could not add that card."));
        });

      return id;
    },
    [confirmNode, projectId, update, workspaceId],
  );

  /** Uploads documents one by one; resolves with the last created node's id. */
  const uploadDocuments = useCallback(
    async (files: File[], position: Point) => {
      let lastId: string | null = null;
      for (const [i, file] of files.entries()) {
        try {
          const node = await placeProjectNode(projectId, workspaceId, {
            kind: "doc",
            title: "",
            file,
            x: position.x + i * UPLOAD_CASCADE_PX,
            y: position.y + i * UPLOAD_CASCADE_PX,
          });
          if (!node) continue;
          lastId = node.id;
          update((b) =>
            b.nodes.some((n) => n.id === node.id)
              ? replaceNode(b, node.id, node)
              : { ...b, nodes: [...b.nodes, node] },
          );
        } catch (error) {
          setActionError(errorText(error, `Could not upload ${file.name}.`));
        }
      }
      return lastId;
    },
    [projectId, update, workspaceId],
  );

  /** Persists a note/doc title or body. Resolves `false` while the node is still optimistic. */
  const saveNode = useCallback(
    async (nodeId: string, input: { title: string; data?: string }) => {
      if (isOptimisticId(nodeId)) return false;
      try {
        const node = await updateProjectNode(projectId, workspaceId, nodeId, input);
        if (node) update((b) => replaceNode(b, nodeId, node));
        return true;
      } catch (error) {
        setActionError(errorText(error, "Could not save your changes."));
        return false;
      }
    },
    [projectId, update, workspaceId],
  );

  /** Appends a reply optimistically. Rejects (after rolling back) if the server refuses it. */
  const replyToThread = useCallback(
    async (threadId: string, message: string) => {
      const before = boardRef.current?.nodes.find((n) => n.id === threadId);
      if (!before || !isCommentNode(before)) return;
      const reply = {
        id: `${OPTIMISTIC_PREFIX}${crypto.randomUUID()}`,
        authorKind: "human" as const,
        authorName: argsRef.current.author?.name ?? "You",
        body: message,
        createdAt: Date.now(),
      };
      update((b) => replaceNode(b, threadId, { ...before, replies: [...before.replies, reply] }));

      try {
        const node = await replyToCommentThread(projectId, workspaceId, { threadId, message });
        if (node) update((b) => replaceNode(b, threadId, node));
        else void reload();
      } catch (error) {
        update((b) => replaceNode(b, threadId, before));
        throw error;
      }
    },
    [projectId, reload, update, workspaceId],
  );

  const setMembers = useCallback(
    (members: MemberPreview[]) => update((b) => ({ ...b, members })),
    [update],
  );

  return {
    board,
    loadError,
    actionError,
    dismissActionError: () => setActionError(null),
    sync,
    moveNode,
    linkNodes,
    unlinkEdge,
    removeNode,
    placeNode,
    uploadDocuments,
    saveNode,
    replyToThread,
    setMembers,
  };
}
