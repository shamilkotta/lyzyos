import type { ProjectStatus, StatusTone, WorkStatus } from "./types";

const WORK_STATUS: Record<WorkStatus, { label: string; tone: StatusTone }> = {
  not_started: { label: "Not started", tone: "neutral" },
  in_progress: { label: "In progress", tone: "info" },
  blocked: { label: "Blocked", tone: "danger" },
  in_review: { label: "In review", tone: "warn" },
  complete: { label: "Complete", tone: "ok" },
  ready: { label: "Ready", tone: "ok" },
};

export function workStatusLabel(status: WorkStatus) {
  return WORK_STATUS[status].label;
}

export function workStatusTone(status: WorkStatus) {
  return WORK_STATUS[status].tone;
}

export function projectStatusLabel(status: ProjectStatus) {
  return status === "in_progress" ? "In progress" : "Complete";
}

export function projectStatusTone(status: ProjectStatus): StatusTone {
  return status === "in_progress" ? "info" : "ok";
}
