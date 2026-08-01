import { afterEach, describe, expect, it, vi } from "vitest";
import { createJob, getJob, listJobEvents, listJobs } from "./jobs";

describe("jobs API", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("uses the backend jobs and events routes with typed JSON requests", async () => {
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify([]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }))
    );
    vi.stubGlobal("fetch", fetchMock);

    await listJobs();
    await getJob("job-1");
    await listJobEvents("job-1");
    await createJob({ type: "sleep", payload: { seconds: 1 } });

    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
      "undefined/jobs",
      "undefined/jobs/job-1",
      "undefined/jobs/job-1/events",
      "undefined/jobs",
    ]);
    expect(fetchMock.mock.calls[3]?.[1]).toMatchObject({
      method: "POST",
      body: JSON.stringify({ type: "sleep", payload: { seconds: 1 } }),
    });
  });
});
