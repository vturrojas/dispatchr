import { useMemo } from "react";
import type { JobEvent } from "../api/types";

export type TimelineItem = JobEvent & {
  key: string;
  source: "history" | "live";
};

function compareEvents(left: TimelineItem, right: TimelineItem) {
  const timestampDifference = Date.parse(left.created_at) - Date.parse(right.created_at);
  return timestampDifference === 0 ? left.id - right.id : timestampDifference;
}

function toTimelineItem(event: JobEvent, source: TimelineItem["source"]): TimelineItem {
  return {
    ...event,
    key: `${source}:${event.id}`,
    source,
  };
}

export function useJobTimeline(history: JobEvent[] | null, live: JobEvent[]) {
  return useMemo(() => {
    const seenIds = new Set<number>();
    const timeline: TimelineItem[] = [];

    for (const [events, source] of [
      [history ?? [], "history"],
      [live, "live"],
    ] as const) {
      for (const event of events) {
        if (seenIds.has(event.id)) continue;
        seenIds.add(event.id);
        timeline.push(toTimelineItem(event, source));
      }
    }

    return [...timeline].sort(compareEvents);
  }, [history, live]);
}
