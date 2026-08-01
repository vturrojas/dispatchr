import { StrictMode } from "react";
import { act, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Job } from "../../api/types";
import { JobsTable } from "./JobsTable";

function job(id: string): Job {
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
    created_at: "2026-07-31T12:00:00.000Z",
    updated_at: "2026-07-31T12:00:00.000Z",
  };
}

function table(jobs: Job[]) {
  return (
    <StrictMode>
      <MemoryRouter>
        <JobsTable jobs={jobs} />
      </MemoryRouter>
    </StrictMode>
  );
}

describe("JobsTable", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("schedules one lifecycle timer only for newly arriving jobs", () => {
    const original = job("original");
    const incoming = job("incoming");
    const view = render(table([original]));

    expect(vi.getTimerCount()).toBe(0);
    view.rerender(table([incoming, original]));
    expect(vi.getTimerCount()).toBe(1);
    expect(screen.getByText("incoming").closest("tr")).toHaveStyle({
      background: "#f3fff6",
    });

    view.rerender(table([incoming, original]));
    expect(vi.getTimerCount()).toBe(1);

    act(() => vi.advanceTimersByTime(1500));
    expect(screen.getByText("incoming").closest("tr")).toHaveStyle({
      background: "transparent",
    });
    expect(vi.getTimerCount()).toBe(0);
    view.unmount();
  });

  it("clears pending timers when StrictMode unmounts", () => {
    const view = render(table([job("original")]));
    view.rerender(table([job("incoming"), job("original")]));
    expect(vi.getTimerCount()).toBe(1);

    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
