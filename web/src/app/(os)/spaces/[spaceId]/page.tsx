"use client";

import { use } from "react";
import { ProjectCampaignView } from "@/components/os/ProjectCampaignView";

export default function SpacePage({ params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = use(params);
  return <ProjectCampaignView spaceId={spaceId} />;
}
