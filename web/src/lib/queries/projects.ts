"use client";

import { useMutation, useQuery, useQueryClient, type Query } from "@tanstack/react-query";
import {
  addProjectMembers,
  addWorkspaceMembers,
  archiveProject,
  createMember,
  createProject,
  createWorkspace,
  fetchAgentStatus,
  getProject,
  getWorkspaceBoard,
  listArchivedProjects,
  listProjects,
  listDirectory,
  listProjectWorkspaces,
  unarchiveProject,
  updateWorkspace,
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

export function useDirectory() {
  return useQuery({
    queryKey: queryKeys.directory,
    queryFn: listDirectory,
    refetchOnWindowFocus: true,
  });
}

export function useCreateMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createMember,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.directory });
    },
  });
}

export function useCreateWorkspace(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; kind?: string }) => createWorkspace(projectId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects.workspaces(projectId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(projectId) });
    },
  });
}

export function useUpdateWorkspace(projectId: string, workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      status?: string;
      statusNote?: string | null;
      attention?: string | null;
    }) => updateWorkspace(projectId, workspaceId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects.workspaces(projectId) });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.projects.board(projectId, workspaceId),
      });
    },
  });
}

export function useAddWorkspaceMembers(projectId: string, workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userIds: string[]) => addWorkspaceMembers(projectId, workspaceId, userIds),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.projects.board(projectId, workspaceId),
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects.workspaces(projectId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(projectId) });
    },
  });
}

export function useAddProjectMembers(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userIds: string[]) => addProjectMembers(projectId, userIds),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(projectId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects.workspaces(projectId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
    },
  });
}

export function useArchivedProjects() {
  return useQuery({
    queryKey: queryKeys.projects.archived,
    queryFn: listArchivedProjects,
    refetchOnWindowFocus: true,
  });
}

export function useArchiveProject(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => archiveProject(projectId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects.archived });
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(projectId) });
    },
  });
}

export function useUnarchiveProject(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => unarchiveProject(projectId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects.archived });
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(projectId) });
    },
  });
}

export function useAgentStatus(projectId: string) {
  const { data } = useQuery({
    queryKey: queryKeys.projects.agentStatus(projectId),
    queryFn: () => fetchAgentStatus(projectId),
    refetchInterval: 3000,
    refetchIntervalInBackground: false,
  });
  return data ?? false;
}
