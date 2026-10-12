import { WorkspaceBoard } from "@/components/workspace/WorkspaceBoard";

export default async function ProjectWorkspacePage({
  params,
}: {
  params: Promise<{ projectId: string; workspaceId: string }>;
}) {
  const { projectId, workspaceId } = await params;
  return (
    <WorkspaceBoard
      key={`${projectId}:${workspaceId}`}
      projectId={projectId}
      workspaceId={workspaceId}
    />
  );
}
