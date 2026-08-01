export const JOB_STATUSES = [
  "queued",
  "scheduled",
  "enqueued",
  "running",
  "succeeded",
  "failed",
  "canceled",
] as const;

export type JobStatus = (typeof JOB_STATUSES)[number];

export type Job = {
  id: string;
  type: string;
  status: JobStatus;
  payload: Record<string, unknown>;
  attempts: number;
  max_attempts: number;
  result: Record<string, unknown> | null;
  last_error: string | null;
  run_at: string | null;
  created_at: string;
  updated_at: string;
};

export type JobEvent = {
  id: number;
  job_id: string;
  event: string;
  message?: string | null;
  data?: unknown;
  created_at: string;
};

export type Executor = {
  name: string;
  description?: string;
  payload_example?: unknown;
};
