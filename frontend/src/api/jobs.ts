import { api } from "./client";
import type { Job } from "./types";

export function listJobs() {
  return api<Job[]>("/jobs");
}

export function createJob(body: { type: string; payload: unknown }) {
  return api<Job>("/jobs", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
