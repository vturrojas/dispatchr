import { useEffect, useRef, useState } from "react";
import type { JobEvent } from "../api/types";

type Args = {
  jobId: string;
  baseUrl: string;
  fromId?: number;
  enabled?: boolean; // when false, do not connect
};

export function useJobStream({ jobId, baseUrl, fromId, enabled = true }: Args) {
  const [streamEvents, setStreamEvents] = useState<JobEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lastEventIdRef = useRef<number | undefined>(fromId);

  // Reset when job changes
  useEffect(() => {
    setStreamEvents([]);
    setConnected(false);
    setError(null);
    lastEventIdRef.current = fromId;
  }, [jobId, fromId]);

  useEffect(() => {
    if (!enabled) {
      setConnected(false);
      return;
    }

    let es: EventSource | null = null;
    let cancelled = false;

    const connect = () => {
      const last = lastEventIdRef.current ?? fromId;
      const url = new URL(`${baseUrl}/jobs/${jobId}/stream`);
      if (typeof last === "number") {
        url.searchParams.set("from_id", String(last));
      }

      setError(null);
      setConnected(false);

      es = new EventSource(url.toString(), { withCredentials: false });

      es.onopen = () => {
        if (cancelled) return;
        setConnected(true);
      };

      es.onerror = () => {
        if (cancelled) return;
        setConnected(false);
        setError("stream disconnected");
        // Browser EventSource will retry automatically.
      };

      // We expect `data:` to be JSON representing a JobEvent-like payload.
      // Server may send different `event:` names (e.g., running, succeeded),
      // but we can normalize using the event type if needed.
      es.onmessage = (ev) => {
        if (cancelled) return;

        try {
          const data = JSON.parse(ev.data) as any;

          // Most SSE servers don't set `id` unless explicitly included.
          // If your server does set an id, it will be in ev.lastEventId.
          const idFromSse =
            ev.lastEventId && ev.lastEventId.trim() !== ""
              ? Number(ev.lastEventId)
              : undefined;

          const normalized: JobEvent = {
            id: typeof data.id === "number" ? data.id : idFromSse ?? -1,
            job_id: data.job_id ?? jobId,
            event: data.event ?? ev.type ?? "message",
            message: data.message ?? null,
            data: data.data ?? data,
            created_at: data.created_at ?? new Date().toISOString(),
          };

          if (typeof normalized.id === "number" && normalized.id >= 0) {
            lastEventIdRef.current = normalized.id;
          }

          setStreamEvents((prev) => [...prev, normalized]);
        } catch (e) {
          setError(e instanceof Error ? e.message : String(e));
        }
      };

      // Also listen for known server-side named events
      const named = [
        "created",
        "queued",
        "enqueued",
        "running",
        "retrying",
        "succeeded",
        "failed",
        "skipped",
      ];

      for (const name of named) {
        es.addEventListener(name, (ev: MessageEvent) => {
          if (cancelled) return;
          try {
            const data = JSON.parse(ev.data) as any;

            const idFromSse =
              (ev as any).lastEventId && String((ev as any).lastEventId).trim() !== ""
                ? Number((ev as any).lastEventId)
                : undefined;

            const normalized: JobEvent = {
              id: typeof data.id === "number" ? data.id : idFromSse ?? -1,
              job_id: data.job_id ?? jobId,
              event: name,
              message: data.message ?? null,
              data: data.data ?? data,
              created_at: data.created_at ?? new Date().toISOString(),
            };

            if (typeof normalized.id === "number" && normalized.id >= 0) {
              lastEventIdRef.current = normalized.id;
            }

            setStreamEvents((prev) => [...prev, normalized]);
          } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
          }
        });
      }
    };

    connect();

    return () => {
      cancelled = true;
      setConnected(false);
      if (es) {
        try {
          es.close();
        } catch {
          // ignore
        }
      }
      es = null;
    };
  }, [jobId, baseUrl, fromId, enabled]);

  return { streamEvents, connected, error };
}
