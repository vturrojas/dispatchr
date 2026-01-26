export type Job = {
  id: string;
  type: string;
  status: string;
  payload: unknown;
  attempts: number;
  max_attempts: number;
  result?: unknown;
  last_error?: string;
  run_at?: string;
  created_at: string;
};

export type JobEvent = {
  id: number;
  job_id: string;
  event: string;
  message?: string;
  data?: unknown;
  created_at: string;
};

export type Executor = {
  name: string;
  description?: string;
  payload_example?: unknown;
};
