import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Job } from "../api/types";

const mocks = vi.hoisted(() => ({ useJobs: vi.fn() }));
vi.mock("../hooks/useJobs", () => ({ useJobs: mocks.useJobs }));

import { JobsPage } from "./JobsPage";

const baseJob: Job = {
  id: "job-1",
  type: "sleep",
  status: "running",
  payload: {},
  attempts: 1,
  max_attempts: 3,
  result: null,
  last_error: null,
  run_at: null,
  created_at: "2026-08-01T12:00:00.000Z",
  updated_at: "2026-08-01T12:00:00.000Z",
};

function renderPage() {
  return render(<MemoryRouter><JobsPage /></MemoryRouter>);
}

describe("JobsPage", () => {
  beforeEach(() => mocks.useJobs.mockReset());
  afterEach(cleanup);

  it("shows loading independently from an API error", () => {
    mocks.useJobs.mockReturnValue({ jobs: null, loading: true, error: "network down" });
    renderPage();

    expect(mocks.useJobs).toHaveBeenCalledWith(3000);
    expect(screen.getByText("Loading…")).toBeInTheDocument();
    expect(screen.getByText(/network down/)).toBeInTheDocument();
    expect(screen.getByText("VITE_API_BASE_URL")).toBeInTheDocument();
  });

  it("shows the empty-state product explanation and copyable curl", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    mocks.useJobs.mockReturnValue({ jobs: [], loading: false, error: null });
    renderPage();

    expect(screen.getByRole("heading", { name: "No jobs yet" })).toBeInTheDocument();
    expect(screen.getByText(/durable event journal/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Copy curl example/ }));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('"type":"sleep"'));
    expect(await screen.findByRole("button", { name: /Copied curl example/ })).toBeInTheDocument();
  });

  it("summarizes statuses and renders job rows", () => {
    const jobs: Job[] = [
      baseJob,
      { ...baseJob, id: "job-2", status: "queued" },
      { ...baseJob, id: "job-3", status: "enqueued" },
      { ...baseJob, id: "job-4", status: "succeeded" },
      { ...baseJob, id: "job-5", status: "failed" },
    ];
    mocks.useJobs.mockReturnValue({ jobs, loading: false, error: null });
    renderPage();

    const metric = (label: string) => screen.getByText(label).parentElement;
    expect(metric("Running")).toHaveTextContent("1");
    expect(metric("Queued")).toHaveTextContent("2");
    expect(metric("Succeeded")).toHaveTextContent("1");
    expect(metric("Failed")).toHaveTextContent("1");
    expect(metric("Total")).toHaveTextContent("5");
    expect(screen.getByRole("link", { name: "job-5" })).toHaveAttribute("href", "/jobs/job-5");
  });
});
