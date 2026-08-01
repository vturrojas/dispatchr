import { useEffect, useState } from "react";
import type { JobEvent } from "../api/types";

type Args = {
  jobId: string;
  baseUrl: string;
  fromId?: number;
  enabled?: boolean;
};

type CachedStream = {
  events: JobEvent[];
  seenIds: ReadonlySet<number>;
  lastId?: number;
};

type JobStreamState = {
  connectionKey: string;
  streamEvents: JobEvent[];
  connected: boolean;
  error: string | null;
};

const NAMED_EVENTS = [
  "created",
  "queued",
  "enqueued",
  "running",
  "retrying",
  "succeeded",
  "failed",
  "skipped",
] as const;

let streamCacheByJob = new Map<string, CachedStream>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readCache(jobId: string, fromId?: number): CachedStream {
  const cached = streamCacheByJob.get(jobId);
  if (cached) return cached;

  return {
    events: [],
    seenIds: new Set(fromId === undefined ? [] : [fromId]),
    lastId: fromId,
  };
}

function storeCache(jobId: string, cache: CachedStream) {
  streamCacheByJob = new Map(streamCacheByJob).set(jobId, cache);
}

function parseJobEvent(value: unknown, jobId: string): JobEvent | null {
  if (!isRecord(value)) return null;
  if (!Number.isInteger(value.id) || (value.id as number) < 0) return null;
  if (value.job_id !== jobId) return null;
  if (typeof value.event !== "string" || value.event.length === 0) return null;
  if (typeof value.created_at !== "string" || !Number.isFinite(Date.parse(value.created_at))) {
    return null;
  }
  if ("message" in value && value.message !== null && typeof value.message !== "string") {
    return null;
  }

  return {
    id: value.id as number,
    job_id: value.job_id,
    event: value.event,
    ...(Object.hasOwn(value, "message") ? { message: value.message as string | null } : {}),
    ...(Object.hasOwn(value, "data") ? { data: value.data } : {}),
    created_at: value.created_at,
  };
}

function parseMessage(message: MessageEvent, jobId: string): JobEvent | null {
  try {
    return parseJobEvent(JSON.parse(String(message.data)) as unknown, jobId);
  } catch {
    return null;
  }
}

function cursorFor(cache: CachedStream, fromId?: number) {
  if (cache.lastId === undefined) return fromId;
  if (fromId === undefined) return cache.lastId;
  return Math.max(cache.lastId, fromId);
}

function streamUrl(baseUrl: string, jobId: string) {
  const normalizedBaseUrl = `${baseUrl.replace(/\/+$/, "")}/`;
  return new URL(`jobs/${encodeURIComponent(jobId)}/stream`, normalizedBaseUrl);
}

export function useJobStream({ jobId, baseUrl, fromId, enabled = true }: Args) {
  const connectionKey = `${jobId}\u0000${baseUrl}\u0000${fromId ?? ""}\u0000${enabled}`;
  const [stateByJob, setStateByJob] = useState<ReadonlyMap<string, JobStreamState>>(
    () => new Map()
  );
  const cached = readCache(jobId, fromId);
  const selected = stateByJob.get(jobId);
  const isCurrentConnection = selected?.connectionKey === connectionKey;

  useEffect(() => {
    if (!enabled) return;

    const initialCache = readCache(jobId, fromId);
    const url = streamUrl(baseUrl, jobId);
    const cursor = cursorFor(initialCache, fromId);
    if (cursor !== undefined) url.searchParams.set("from_id", String(cursor));

    const source = new EventSource(url, { withCredentials: false });
    let active = true;

    const updateState = (
      update: (current: JobStreamState) => JobStreamState
    ) => {
      if (!active) return;
      setStateByJob((previous) => {
        const current = previous.get(jobId) ?? {
          connectionKey,
          streamEvents: readCache(jobId, fromId).events,
          connected: false,
          error: null,
        };
        const next = update(current);
        return new Map(previous).set(jobId, next);
      });
    };

    const receive = (message: MessageEvent) => {
      const event = parseMessage(message, jobId);
      if (!event) return;

      const currentCache = readCache(jobId, fromId);
      if (currentCache.seenIds.has(event.id)) return;

      const nextCache: CachedStream = {
        events: [...currentCache.events, event],
        seenIds: new Set([...currentCache.seenIds, event.id]),
        lastId: Math.max(currentCache.lastId ?? event.id, event.id),
      };
      storeCache(jobId, nextCache);
      updateState((current) => ({
        ...current,
        connectionKey,
        streamEvents: nextCache.events,
      }));
    };

    source.onopen = () => {
      updateState((current) => ({
        ...current,
        connectionKey,
        connected: true,
        error: null,
      }));
    };
    source.onerror = () => {
      updateState((current) => ({
        ...current,
        connectionKey,
        connected: false,
        error: "stream disconnected",
      }));
    };
    source.onmessage = receive;
    for (const eventName of NAMED_EVENTS) source.addEventListener(eventName, receive);

    return () => {
      active = false;
      source.close();
    };
  }, [baseUrl, connectionKey, enabled, fromId, jobId]);

  return {
    streamEvents: isCurrentConnection ? selected.streamEvents : cached.events,
    connected: enabled && isCurrentConnection ? selected.connected : false,
    error: enabled && isCurrentConnection ? selected.error : null,
  };
}
