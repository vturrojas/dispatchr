import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import type { TimelineItem } from "../../hooks/useJobTimeline";
import { AttemptedTimeline } from "./AttemptedTimeline";

const created: TimelineItem = {
  key: "created",
  id: 1,
  job_id: "job-1",
  source: "history",
  event: "created",
  created_at: "2026-07-31T12:00:00.000Z",
};

const attempted: TimelineItem[] = [
  created,
  {
    key: "running",
    id: 2,
    job_id: "job-1",
    source: "history",
    event: "running",
    message: "Worker started attempt 1",
    created_at: "2026-07-31T12:00:01.000Z",
  },
];

describe("AttemptedTimeline", () => {
  it("keeps hook order stable across empty, ungrouped, and attempted items", () => {
    Element.prototype.scrollIntoView = vi.fn();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const view = render(<AttemptedTimeline items={[]} />, { wrapper: MemoryRouter });

    expect(screen.getByText("No events yet.")).toBeInTheDocument();
    view.rerender(<AttemptedTimeline items={[created]} />);
    expect(screen.getByText(/created/)).toBeInTheDocument();
    view.rerender(<AttemptedTimeline items={attempted} />);
    expect(screen.getByText("Attempt 1")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Collapse attempts" })).toBeChecked();
    expect(consoleError).not.toHaveBeenCalled();

    consoleError.mockRestore();
    view.unmount();
  });

  it("renders attempt summaries and duration formats from backend messages", async () => {
    Element.prototype.scrollIntoView = vi.fn();
    const items: TimelineItem[] = [
      { ...created, key: "queued", id: 2, event: "queued" },
      { ...created, key: "run-1", id: 3, event: "running", message: "attempt 1", created_at: "2026-07-31T12:00:00.000Z" },
      { ...created, key: "retry", id: 4, event: "retrying", created_at: "2026-07-31T12:00:30.000Z" },
      { ...created, key: "run-2", id: 5, event: "running", message: "attempt 2", created_at: "2026-07-31T13:00:00.000Z" },
      { ...created, key: "failed", id: 6, event: "failed", created_at: "2026-07-31T14:05:00.000Z" },
    ];
    render(<AttemptedTimeline items={items} />, { wrapper: MemoryRouter });

    expect(screen.getByText("Pre-run")).toBeInTheDocument();
    expect(screen.getByText("Attempt 1")).toBeInTheDocument();
    expect(screen.getByText("Attempt 2")).toBeInTheDocument();
    expect(screen.getAllByText(/retrying/)).toHaveLength(2);
    expect(screen.getByText(/dur 30s/)).toBeInTheDocument();
    expect(screen.getByText(/dur 1h 5m/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("checkbox", { name: "Collapse attempts" }));
    expect(screen.getByRole("checkbox", { name: "Collapse attempts" })).not.toBeChecked();
  });
});
