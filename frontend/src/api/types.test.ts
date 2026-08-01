import { describe, expect, it } from "vitest";
import { JOB_STATUSES, type Job, type JobStatus } from "./types";

describe("job lifecycle types", () => {
  it("defines the persisted job statuses", () => {
    expect(JOB_STATUSES).toEqual([
      "queued",
      "scheduled",
      "enqueued",
      "running",
      "succeeded",
      "failed",
      "canceled",
    ]);
    expect(JOB_STATUSES).not.toContain("retrying");
  });

  it("accepts enqueued as a job status", () => {
    const status: JobStatus = "enqueued";

    expect(status).toBe("enqueued");
  });

  it("allows a job result to be null", () => {
    const job: Job = {
      id: "job-1",
      type: "example",
      status: "queued",
      payload: {},
      attempts: 0,
      max_attempts: 3,
      result: null,
      last_error: null,
      run_at: null,
      created_at: "2026-08-01T00:00:00Z",
      updated_at: "2026-08-01T00:00:00Z",
    };

    expect(job.result).toBeNull();
  });
});
