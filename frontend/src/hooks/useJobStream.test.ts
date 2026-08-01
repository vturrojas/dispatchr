import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useJobStream } from "./useJobStream";

type EventListener = (event: MessageEvent<string>) => void;

class EventSourceMock {
  static instances: EventSourceMock[] = [];

  readonly url: string;
  readonly listeners = new Map<string, EventListener[]>();
  onopen: ((event: Event) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent<string>) => void) | null = null;
  close = vi.fn();

  constructor(url: string | URL) {
    this.url = String(url);
    EventSourceMock.instances = [...EventSourceMock.instances, this];
  }

  addEventListener(type: string, listener: EventListener) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  emit(type: string, data: string, lastEventId = "") {
    const event = new MessageEvent<string>(type, { data, lastEventId });
    if (type === "message") this.onmessage?.(event);
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }
}

function latestSource() {
  const source = EventSourceMock.instances.at(-1);
  if (!source) throw new Error("Expected EventSource to be constructed");
  return source;
}

describe("useJobStream", () => {
  beforeEach(() => {
    EventSourceMock.instances = [];
    vi.stubGlobal("EventSource", EventSourceMock);
  });

  afterEach(() => vi.unstubAllGlobals());

  it("ignores malformed external payloads and accepts a valid backend event once", () => {
    const { result, unmount } = renderHook(() =>
      useJobStream({ jobId: "validation-job", baseUrl: "https://dispatchr.test", fromId: 3 })
    );
    const source = latestSource();

    expect(source.url).toBe("https://dispatchr.test/jobs/validation-job/stream?from_id=3");
    act(() => {
      source.emit("message", "not json");
      source.emit("message", "null");
      source.emit("running", JSON.stringify({ id: "4", event: "running" }));
      source.emit("running", JSON.stringify({ id: -1, job_id: "validation-job", event: "running", created_at: "2026-07-31T12:00:04.000Z" }));
      source.emit("running", JSON.stringify({ id: 4, job_id: "other-job", event: "running", created_at: "2026-07-31T12:00:04.000Z" }));
      source.emit("running", JSON.stringify({ id: 4, job_id: "validation-job", event: "", created_at: "2026-07-31T12:00:04.000Z" }));
      source.emit("running", JSON.stringify({ id: 4, job_id: "validation-job", event: "running", created_at: "invalid" }));
      source.emit("running", JSON.stringify({ id: 4, job_id: "validation-job", event: "running", message: 42, created_at: "2026-07-31T12:00:04.000Z" }));
      source.emit(
        "running",
        JSON.stringify({
          id: 4,
          job_id: "validation-job",
          event: "running",
          message: null,
          data: { attempt: 1 },
          created_at: "2026-07-31T12:00:04.000Z",
        })
      );
      source.emit(
        "message",
        JSON.stringify({
          id: 4,
          job_id: "validation-job",
          event: "running",
          message: null,
          created_at: "2026-07-31T12:00:04.000Z",
        })
      );
    });

    expect(result.current.error).toBeNull();
    expect(result.current.streamEvents).toHaveLength(1);
    expect(result.current.streamEvents[0]).toMatchObject({ id: 4, job_id: "validation-job" });
    act(() => source.onerror?.(new Event("error")));
    expect(result.current).toMatchObject({ connected: false, error: "stream disconnected" });
    unmount();
  });

  it("does not connect when disabled", () => {
    const { result, unmount } = renderHook(() =>
      useJobStream({ jobId: "disabled-job", baseUrl: "https://dispatchr.test", enabled: false })
    );

    expect(EventSourceMock.instances).toHaveLength(0);
    expect(result.current).toEqual({ streamEvents: [], connected: false, error: null });
    unmount();
  });

  it("keys state and cleanup to the requested job", () => {
    const { result, rerender, unmount } = renderHook(
      ({ jobId }: { jobId: string }) =>
        useJobStream({ jobId, baseUrl: "https://dispatchr.test", fromId: 9 }),
      { initialProps: { jobId: "job-a" } }
    );
    const first = latestSource();
    act(() => first.onopen?.(new Event("open")));
    expect(result.current.connected).toBe(true);

    rerender({ jobId: "job-b" });
    expect(first.close).toHaveBeenCalledOnce();
    expect(latestSource().url).toContain("/jobs/job-b/stream?from_id=9");
    expect(result.current.streamEvents).toEqual([]);
    expect(result.current.connected).toBe(false);

    const second = latestSource();
    unmount();
    expect(second.close).toHaveBeenCalledOnce();
  });

  it("carries its accepted cursor and dedupe identity across remounts", () => {
    const firstHook = renderHook(() =>
      useJobStream({ jobId: "remount-job", baseUrl: "https://dispatchr.test" })
    );
    const firstSource = latestSource();
    act(() =>
      firstSource.emit(
        "succeeded",
        JSON.stringify({
          id: 7,
          job_id: "remount-job",
          event: "succeeded",
          message: "done",
          created_at: "2026-07-31T12:00:07.000Z",
        })
      )
    );
    firstHook.unmount();

    const secondHook = renderHook(() =>
      useJobStream({ jobId: "remount-job", baseUrl: "https://dispatchr.test" })
    );
    const secondSource = latestSource();
    expect(secondSource.url).toBe("https://dispatchr.test/jobs/remount-job/stream?from_id=7");
    act(() =>
      secondSource.emit(
        "message",
        JSON.stringify({
          id: 7,
          job_id: "remount-job",
          event: "succeeded",
          message: "done",
          created_at: "2026-07-31T12:00:07.000Z",
        })
      )
    );
    expect(secondHook.result.current.streamEvents.map((event) => event.id)).toEqual([7]);
    secondHook.unmount();
  });
});
