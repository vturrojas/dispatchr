import { api } from "./client";
import type { Job, JobEvent } from "./types";

export function listJobs() {
  return api<Job[]>("/jobs");
}

export function createJob(body: { type: string; payload: unknown }) {
  return api<Job>("/jobs", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function getJob(jobId: string) {
  return api<Job>(`/jobs/${jobId}`);
}

export function listJobEvents(jobId: string) {
  return api<JobEvent[]>(`/jobs/${jobId}/events`);
}
