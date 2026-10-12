"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addProjectMembers,
  addWorkspaceMembers,
  createMember,
  createProject,
  createWorkspace,
  fetchAgentStatus,
  getProject,
  getWorkspaceBoard,
  listArchivedProjects,
  listDirectory,
  listProjects,
  listProjectWorkspaces,
  setProjectArchived,
} from "@/lib/api";
import { UNTITLED_PROJECT } from "@/lib/constants";
import { queryKeys } from "@/lib/query-keys";

const UNTITLED_POLL_MS = 2_500;
const AGENT_STATUS_POLL_MS = 3_000;

export function useProjects() {
  return useQuery({ queryKey: queryKeys.projects.all, queryFn: listProjects });
}

export function useArchivedProjects() {
  return useQuery({ queryKey: queryKeys.projects.archived, queryFn: listArchivedProjects });
}

export function useProject(projectId: string | null) {
  return useQuery({
    queryKey: queryKeys.projects.detail(projectId ?? ""),
    queryFn: () => getProject(projectId!),
    enabled: Boolean(projectId),
    // The agent renames new projects shortly after kickoff; poll until it has.
    refetchInterval: (query) =>
      query.state.data?.name === UNTITLED_PROJECT ? UNTITLED_POLL_MS : false,
  });
}

export function useProjectWorkspaces(projectId: string) {
  return useQuery({
    queryKey: queryKeys.projects.workspaces(projectId),
    queryFn: () => listProjectWorkspaces(projectId),
    enabled: Boolean(projectId),
  });
}

export function useProjectBoard(projectId: string | null, workspaceId: string | null) {
  return useQuery({
    queryKey: queryKeys.projects.board(projectId ?? "", workspaceId ?? ""),
    queryFn: () => getWorkspaceBoard(projectId!, workspaceId!),
    enabled: Boolean(projectId && workspaceId),
  });
}

export function useAgentStatus(projectId: string) {
  const { data } = useQuery({
    queryKey: queryKeys.projects.agentStatus(projectId),
    queryFn: () => fetchAgentStatus(projectId),
    refetchInterval: AGENT_STATUS_POLL_MS,
    retry: false,
  });
  return data ?? false;
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createProject,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.projects.all }),
  });
}

export function useSetProjectArchived(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (archived: boolean) => setProjectArchived(projectId, archived),
    // `projects.all` is a prefix of the archived list and the project detail.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.projects.all }),
  });
}

export function useCreateWorkspace(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; kind?: string }) => createWorkspace(projectId, input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.workspaces(projectId) }),
  });
}

export function useAddProjectMembers(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userIds: string[]) => addProjectMembers(projectId, userIds),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(projectId) }),
  });
}

export function useAddWorkspaceMembers(projectId: string, workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userIds: string[]) => addWorkspaceMembers(projectId, workspaceId, userIds),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(projectId) }),
  });
}

export function useDirectory() {
  return useQuery({ queryKey: queryKeys.directory, queryFn: listDirectory });
}

export function useCreateMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createMember,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.directory }),
  });
}
