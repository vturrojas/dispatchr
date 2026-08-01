import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Job, JobEvent } from "../api/types";
import { getJob, listJobEvents } from "../api/jobs";
import { JobDetailPage } from "./JobDetailPage";

vi.mock("../api/jobs", () => ({
  getJob: vi.fn(),
  listJobEvents: vi.fn(),
}));

vi.mock("../hooks/useJobStream", () => ({
  useJobStream: () => ({ streamEvents: [], connected: false, error: null }),
}));

const completedJob: Job = {
  id: "job-1",
  type: "sleep",
  status: "succeeded",
  payload: {},
  attempts: 1,
  max_attempts: 3,
  result: { slept: 5 },
  last_error: null,
  run_at: null,
  created_at: "2026-07-31T12:00:00.000Z",
  updated_at: "2026-07-31T12:00:05.000Z",
};

const completedEvents: JobEvent[] = [
  {
    id: 1,
    job_id: "job-1",
    event: "running",
    message: "Worker started attempt 1",
    created_at: "2026-07-31T12:00:00.000Z",
  },
  {
    id: 2,
    job_id: "job-1",
    event: "succeeded",
    message: "finished",
    created_at: "2026-07-31T12:00:05.000Z",
  },
];

function route(initialEntry: string, path: string) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path={path} element={<JobDetailPage />} />
        <Route path="*" element={<h1>404 Route not found</h1>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("JobDetailPage", () => {
  beforeEach(() => {
    vi.mocked(getJob).mockReset();
    vi.mocked(listJobEvents).mockReset();
    Element.prototype.scrollIntoView = vi.fn();
  });

  it("redirects a missing route parameter to the existing 404 route before API work", async () => {
    route("/detail", "/detail");

    expect(await screen.findByRole("heading", { name: "404 Route not found" })).toBeInTheDocument();
    expect(getJob).not.toHaveBeenCalled();
    expect(listJobEvents).not.toHaveBeenCalled();
  });

  it("uses persisted running and terminal timestamps for completed duration", async () => {
    vi.mocked(getJob).mockResolvedValue(completedJob);
    vi.mocked(listJobEvents).mockResolvedValue(completedEvents);
    route("/jobs/job-1", "/jobs/:jobId");

    await waitFor(() => expect(getJob).toHaveBeenCalledWith("job-1"));
    expect(await screen.findAllByText("5s")).toHaveLength(2);
  });

  it("keeps the job visible when only historical events fail to load", async () => {
    vi.mocked(getJob).mockResolvedValue({ ...completedJob, status: "running" });
    vi.mocked(listJobEvents).mockRejectedValue(new Error("events unavailable"));
    const view = route("/jobs/job-1", "/jobs/:jobId");

    expect(await screen.findByText(/events unavailable/)).toBeInTheDocument();
    expect(screen.getAllByText("running").length).toBeGreaterThan(0);
    expect(screen.getByText("No events yet.")).toBeInTheDocument();
    view.unmount();
  });
});
