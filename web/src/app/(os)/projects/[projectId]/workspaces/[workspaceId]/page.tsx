"use client";

import { use } from "react";
import { WorkspaceBoard } from "@/components/workspace/WorkspaceBoard";

export default function ProjectWorkspacePage({
  params,
}: {
  params: Promise<{ projectId: string; workspaceId: string }>;
}) {
  const { projectId, workspaceId } = use(params);
  return <WorkspaceBoard key={`${projectId}:${workspaceId}`} projectId={projectId} workspaceId={workspaceId} />;
}
