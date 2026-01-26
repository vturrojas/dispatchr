import { useEffect, useRef, useState } from "react";
import { listJobs } from "../api/jobs";
import type { Job } from "../api/types";

export function useJobs(pollMs = 3000) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const timer = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setError(null);
        const data = await listJobs();
        if (cancelled) return;

        // newest first
        data.sort((a, b) => (Date.parse(b.created_at) || 0) - (Date.parse(a.created_at) || 0));
        setJobs(data);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    timer.current = window.setInterval(load, pollMs);

    return () => {
      cancelled = true;
      if (timer.current) window.clearInterval(timer.current);
    };
  }, [pollMs]);

  return { jobs, loading, error };
}
