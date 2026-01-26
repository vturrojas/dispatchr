import { api } from "./client";
import type { Job } from "./types";

export function listJobs() {
  return api<Job[]>("/jobs");
}
