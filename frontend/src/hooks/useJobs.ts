import { useEffect, useMemo, useState } from "react";
import { listJobs } from "../api/jobs";
import type { Job } from "../api/types";

type Listener = (jobs: Job[] | null) => void;

// Module-level cache shared across all hook instances (simple & effective)
let JOBS_CACHE: Job[] | null = null;
const LISTENERS = new Set<Listener>();

function notify() {
  for (const fn of LISTENERS) fn(JOBS_CACHE);
}

function safeDateMs(value: unknown): number {
  const ms = new Date(String(value ?? "")).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function sortJobsDesc(list: Job[]): Job[] {
  return list
    .slice()
    .sort((a, b) => safeDateMs(b.created_at) - safeDateMs(a.created_at));
}

function upsertJobInto(list: Job[], job: Job): Job[] {
  const idx = list.findIndex((j) => j.id === job.id);
  if (idx === -1) return sortJobsDesc([job, ...list]);

  // Merge to keep any fields the list item has that the incoming job might not.
  const next = list.slice();
  next[idx] = { ...next[idx], ...job };
  return sortJobsDesc(next);
}

function mergeJobsById(prev: Job[], fetched: Job[]): Job[] {
  const map = new Map<string, Job>();
  for (const j of prev) map.set(j.id, j);
  for (const j of fetched) {
    const existing = map.get(j.id);
    map.set(j.id, existing ? { ...existing, ...j } : j);
  }
  return sortJobsDesc(Array.from(map.values()));
}

/**
 * Call this right after createJob() returns.
 * It updates the Jobs dashboard immediately (without waiting for the next poll).
 */
export function optimisticUpsertJob(job: Job) {
  JOBS_CACHE = JOBS_CACHE ? upsertJobInto(JOBS_CACHE, job) : sortJobsDesc([job]);
  notify();
}

/**
 * Optional: if you want other pages to push a job-list refresh into the shared cache,
 * you can call this with a full list. We merge to preserve optimistic entries.
 */
export function optimisticReplaceJobs(jobs: Job[]) {
  JOBS_CACHE = JOBS_CACHE ? mergeJobsById(JOBS_CACHE, jobs) : sortJobsDesc(jobs);
  notify();
}

export function useJobs(pollMs = 3000) {
  const [jobs, setJobs] = useState<Job[] | null>(JOBS_CACHE);
  const [loading, setLoading] = useState(JOBS_CACHE == null);
  const [error, setError] = useState<string | null>(null);

  // Subscribe to cache updates
  useEffect(() => {
    const fn: Listener = (j) => setJobs(j);
    LISTENERS.add(fn);
    return () => {
      LISTENERS.delete(fn);
    };
  }, []);

  // Poll backend and update cache
  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      try {
        setError(null);
        const fetched = await listJobs();
        if (cancelled) return;

        // Merge instead of replace so we never "lose" an optimistic insert briefly.
        JOBS_CACHE = JOBS_CACHE ? mergeJobsById(JOBS_CACHE, fetched) : sortJobsDesc(fetched);
        notify();
        setLoading(false);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
        setLoading(false);
      }
    }

    // Immediate fetch on mount
    refresh();

    const id = window.setInterval(refresh, pollMs);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [pollMs]);

  return useMemo(() => ({ jobs, loading, error }), [jobs, loading, error]);
}
