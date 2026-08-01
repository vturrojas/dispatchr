import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import type { Job } from "../api/types";
import { listJobs } from "../api/jobs";
import { optimisticReplaceJobs, optimisticUpsertJob, useJobs } from "./useJobs";

vi.mock("../api/jobs", () => ({ listJobs: vi.fn() }));

function job(id: string, createdAt: string, updatedAt: string): Job {
  return {
    id,
    type: "sleep",
    status: "queued",
    payload: {},
    attempts: 0,
    max_attempts: 3,
    result: null,
    last_error: null,
    run_at: null,
    created_at: createdAt,
    updated_at: updatedAt,
  };
}

describe("useJobs", () => {
  afterEach(() => vi.useRealTimers());

  it("keeps the typed backend response and sorts by created_at", async () => {
    const older = job("older", "2026-07-31T12:00:00.000Z", "2026-07-31T14:00:00.000Z");
    const newer = job("newer", "2026-07-31T13:00:00.000Z", "2026-07-31T13:00:00.000Z");
    const newest = job("newest", "2026-07-31T14:00:00.000Z", "2026-07-31T14:00:00.000Z");
    optimisticReplaceJobs([older]);
    optimisticUpsertJob(newer);
    optimisticUpsertJob({ ...newer, status: "running" });
    optimisticReplaceJobs([older, newest]);
    vi.mocked(listJobs).mockResolvedValue([older, newer]);

    const hook = renderHook(() => useJobs(60_000));
    await waitFor(() =>
      expect(hook.result.current.jobs?.find(({ id }) => id === "newer")?.status).toBe("queued")
    );

    expect(hook.result.current.jobs?.map(({ id }) => id)).toEqual(["newest", "newer", "older"]);
    expectTypeOf(hook.result.current.jobs).toEqualTypeOf<Job[] | null>();
    hook.unmount();
  });

  it("reports polling errors without discarding the shared typed cache", async () => {
    vi.mocked(listJobs).mockRejectedValue(new Error("offline"));
    const hook = renderHook(() => useJobs(60_000));

    await waitFor(() => expect(hook.result.current.error).toBe("offline"));
    expect(hook.result.current.jobs?.length).toBeGreaterThan(0);
    hook.unmount();
  });
});
