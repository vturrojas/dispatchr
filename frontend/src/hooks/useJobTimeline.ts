import { useMemo } from "react";
import type { JobEvent } from "../api/types";

type LiveEvent = {
  event: string;
  data: any;
  id?: number;
  received_at: string;
};

export type TimelineItem = {
  key: string;
  id?: number;
  source: "history" | "live";
  event: string;
  message?: string;
  data?: unknown;
  created_at: string; // for ordering
};

export function useJobTimeline(history: JobEvent[] | null, live: LiveEvent[]) {
  return useMemo(() => {
    const items: TimelineItem[] = [];

    const seenIds = new Set<number>();

    if (history) {
      for (const e of history) {
        if (typeof e.id === "number") seenIds.add(e.id);
        items.push({
          key: `h:${e.id}`,
          id: e.id,
          source: "history",
          event: e.event,
          message: e.message,
          data: e.data,
          created_at: e.created_at,
        });
      }
    }

    for (const e of live) {
      // de-dupe if server uses SSE id as job_event id
      if (typeof e.id === "number" && seenIds.has(e.id)) continue;

      items.push({
        key: `l:${e.id ?? e.received_at}:${e.event}`,
        id: e.id,
        source: "live",
        event: e.event,
        data: e.data,
        created_at: e.received_at, // approximate ordering
      });
    }

    // order by created_at, then id if available
    items.sort((a, b) => {
      const ta = Date.parse(a.created_at) || 0;
      const tb = Date.parse(b.created_at) || 0;
      if (ta !== tb) return ta - tb;

      const ia = a.id ?? -1;
      const ib = b.id ?? -1;
      return ia - ib;
    });

    return items;
  }, [history, live]);
}
