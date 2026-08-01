import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { JobEvent } from "../api/types";
import { useJobTimeline } from "./useJobTimeline";

function event(overrides: Partial<JobEvent> & Pick<JobEvent, "id" | "event" | "created_at">): JobEvent {
  return {
    job_id: "job-1",
    ...overrides,
  };
}

describe("useJobTimeline", () => {
  it("immutably dedupes and orders unified history and live JobEvents", () => {
    const history = [
      event({ id: 2, event: "running", created_at: "2026-07-31T12:00:02.000Z", message: null }),
      event({ id: 1, event: "created", created_at: "2026-07-31T12:00:01.000Z", message: "created exactly" }),
    ];
    const live = [
      event({ id: 2, event: "running", created_at: "2026-07-31T12:00:02.000Z", message: "duplicate" }),
      event({ id: 4, event: "succeeded", created_at: "2026-07-31T12:00:03.000Z" }),
      event({ id: 3, event: "progress", created_at: "2026-07-31T12:00:03.000Z", message: "50%" }),
    ];
    const originalHistory = structuredClone(history);
    const originalLive = structuredClone(live);

    const { result } = renderHook(() => useJobTimeline(history, live));

    expect(result.current.map((item) => item.id)).toEqual([1, 2, 3, 4]);
    expect(result.current[0].message).toBe("created exactly");
    expect(result.current[1].message).toBeNull();
    expect(result.current[2].message).toBe("50%");
    expect(result.current[3]).not.toHaveProperty("message");
    expect(result.current[3].created_at).toBe("2026-07-31T12:00:03.000Z");
    expect(history).toEqual(originalHistory);
    expect(live).toEqual(originalLive);
  });
});
