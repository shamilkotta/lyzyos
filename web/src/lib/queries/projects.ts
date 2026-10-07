"use client";

import { useMutation, useQuery, useQueryClient, type Query } from "@tanstack/react-query";
import {
  createProject,
  getProject,
  getWorkspaceBoard,
  listProjects,
  listProjectWorkspaces,
} from "@/lib/api";
import type { ApiProjectListItem } from "@/lib/project-types";
import { queryKeys } from "@/lib/query-keys";

type ProjectsRefetchInterval =
  | number
  | false
  | ((query: Query<ApiProjectListItem[]>) => number | false | undefined);

export function useProjects(options?: { refetchInterval?: ProjectsRefetchInterval }) {
  return useQuery({
    queryKey: queryKeys.projects.all,
    queryFn: listProjects,
    refetchOnWindowFocus: true,
    refetchInterval: options?.refetchInterval,
  });
}

export function useProject(projectId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.projects.detail(projectId),
    queryFn: () => getProject(projectId),
    enabled: (options?.enabled ?? true) && Boolean(projectId),
    refetchOnWindowFocus: true,
  });
}

export function useProjectWorkspaces(projectId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.projects.workspaces(projectId),
    queryFn: () => listProjectWorkspaces(projectId),
    enabled: (options?.enabled ?? true) && Boolean(projectId),
    refetchOnWindowFocus: true,
  });
}

export function useDefaultWorkspace(projectId: string, options?: { enabled?: boolean }) {
  const query = useProjectWorkspaces(projectId, options);
  const workspace = query.data?.[0] ?? null;
  return { ...query, workspace, workspaceId: workspace?.id ?? null };
}

export function useProjectBoard(
  projectId: string,
  options?: { enabled?: boolean; workspaceId?: string | null },
) {
  const workspaceId = options?.workspaceId ?? null;
  return useQuery({
    queryKey: queryKeys.projects.board(projectId, workspaceId ?? ""),
    queryFn: () => {
      if (!workspaceId) throw new Error("workspaceId required");
      return getWorkspaceBoard(projectId, workspaceId);
    },
    enabled: (options?.enabled ?? true) && Boolean(projectId) && Boolean(workspaceId),
    refetchOnWindowFocus: true,
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createProject,
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
      if (result.projectId) {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.projects.detail(result.projectId),
        });
        void queryClient.invalidateQueries({
          queryKey: queryKeys.projects.workspaces(result.projectId),
        });
        void queryClient.invalidateQueries({
          queryKey: queryKeys.projects.board(result.projectId, result.workspaceId),
        });
      }
    },
  });
}
