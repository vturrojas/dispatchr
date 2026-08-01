import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { TimelineItem } from "../../hooks/useJobTimeline";
import { Timeline } from "./Timeline";

function item(id: number): TimelineItem {
  return {
    key: `history:${id}`,
    id,
    job_id: "job-1",
    source: "history",
    event: `event-${id}`,
    created_at: `2026-07-31T12:00:0${id}.000Z`,
  };
}

describe("Timeline", () => {
  it("preserves a paused scroll position until the user jumps to latest", () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    const view = render(<Timeline items={[item(1)]} />);
    const scrolling = view.container.querySelector<HTMLDivElement>('div[style*="overflow: auto"]');
    if (!scrolling) throw new Error("Expected timeline scrolling container");

    Object.defineProperties(scrolling, {
      scrollHeight: { configurable: true, value: 1000 },
      clientHeight: { configurable: true, value: 200 },
      scrollTop: { configurable: true, value: 100, writable: true },
    });
    fireEvent.scroll(scrolling);
    expect(screen.getByText("Paused")).toBeInTheDocument();
    const callsWhenPaused = scrollIntoView.mock.calls.length;

    view.rerender(<Timeline items={[item(1), item(2)]} />);
    expect(scrollIntoView).toHaveBeenCalledTimes(callsWhenPaused);
    expect(scrolling.scrollTop).toBe(100);

    fireEvent.click(screen.getByRole("button", { name: "Jump to latest" }));
    expect(scrollIntoView.mock.calls.length).toBeGreaterThan(callsWhenPaused);
    expect(screen.queryByText("Paused")).not.toBeInTheDocument();
    view.unmount();
  });

  it("renders live metadata, messages, data, invalid timestamps, and empty state", () => {
    Element.prototype.scrollIntoView = vi.fn();
    const rich: TimelineItem = {
      ...item(3),
      source: "live",
      event: "succeeded",
      message: "backend message",
      data: 1n,
      created_at: "invalid timestamp",
    };
    const view = render(<Timeline items={[rich]} />);

    expect(screen.getByText("backend message")).toBeInTheDocument();
    expect(screen.getByText("live • id 3")).toBeInTheDocument();
    expect(screen.getByText("invalid timestamp")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();

    view.rerender(<Timeline items={[]} />);
    expect(screen.getByText("No events yet.")).toBeInTheDocument();
    view.unmount();
  });
});
