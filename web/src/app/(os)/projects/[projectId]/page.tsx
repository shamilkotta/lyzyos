"use client";

import { use } from "react";
import { ProjectCampaignView } from "@/components/os/ProjectCampaignView";
import { useProject } from "@/lib/queries/projects";

export default function ProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params);
  const { data: project } = useProject(projectId);

  return <ProjectCampaignView projectId={projectId} projectName={project?.name} />;
}
