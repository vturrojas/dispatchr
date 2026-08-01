import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Job } from "../api/types";

const mocks = vi.hoisted(() => ({
  createJob: vi.fn(),
  navigate: vi.fn(),
  optimisticUpsertJob: vi.fn(),
}));

vi.mock("../api/jobs", () => ({ createJob: mocks.createJob }));
vi.mock("../hooks/useJobs", () => ({ optimisticUpsertJob: mocks.optimisticUpsertJob }));
vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router")>();
  return { ...actual, useNavigate: () => mocks.navigate };
});
vi.mock("../components/forms/CreateJobForm", () => ({
  CreateJobForm: ({ onSubmit, submitting }: {
    onSubmit: (args: { type: string; payload: unknown }) => Promise<void>;
    submitting?: boolean;
  }) => (
    <button type="button" disabled={submitting} onClick={() => void onSubmit({ type: "sleep", payload: { seconds: 2 } })}>
      {submitting ? "Submitting" : "Submit fixture"}
    </button>
  ),
}));

import { CreateJobPage } from "./CreateJobPage";

const job: Job = {
  id: "job-created",
  type: "sleep",
  status: "queued",
  payload: { seconds: 2 },
  attempts: 0,
  max_attempts: 3,
  result: null,
  last_error: null,
  run_at: null,
  created_at: "2026-08-01T00:00:00.000Z",
  updated_at: "2026-08-01T00:00:00.000Z",
};

function renderPage() {
  return render(<MemoryRouter><CreateJobPage /></MemoryRouter>);
}

describe("CreateJobPage", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mocks.createJob.mockReset();
    mocks.navigate.mockReset();
    mocks.optimisticUpsertJob.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("optimistically upserts a created job and navigates after 250ms", async () => {
    mocks.createJob.mockResolvedValue(job);
    renderPage();

    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Submit fixture" })));

    expect(mocks.createJob).toHaveBeenCalledWith({ type: "sleep", payload: { seconds: 2 } });
    expect(mocks.optimisticUpsertJob).toHaveBeenCalledWith(job);
    expect(screen.getByRole("status")).toHaveTextContent("Job created — opening details…");
    expect(mocks.navigate).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(249));
    expect(mocks.navigate).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(mocks.navigate).toHaveBeenCalledWith("/jobs/job-created");
  });

  it("keeps creation failures on the page without navigating", async () => {
    mocks.createJob.mockRejectedValue(new Error("backend unavailable"));
    renderPage();

    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Submit fixture" })));

    expect(screen.getByRole("status")).toHaveTextContent("backend unavailable");
    act(() => vi.advanceTimersByTime(3000));
    expect(mocks.optimisticUpsertJob).not.toHaveBeenCalled();
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it("allows the visible toast to be dismissed", async () => {
    mocks.createJob.mockRejectedValue("plain failure");
    renderPage();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Submit fixture" })));

    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
