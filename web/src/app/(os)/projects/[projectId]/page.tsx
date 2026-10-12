import { ProjectOverview } from "@/components/project/ProjectOverview";

export default async function ProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return <ProjectOverview projectId={projectId} />;
}
