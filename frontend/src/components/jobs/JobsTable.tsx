import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import type { Job } from "../../api/types";

function fmt(iso: string) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return iso;
  return new Date(t).toLocaleString();
}

export function JobsTable({ jobs }: { jobs: Job[] }) {
  const [highlighted, setHighlighted] = useState<Set<string>>(new Set());
  const seenIdsRef = useRef<Set<string> | null>(null);
  const timersRef = useRef<number[]>([]);

  useEffect(() => {
    const jobIds = new Set(jobs.map((job) => job.id));
    const seenIds = seenIdsRef.current;
    if (seenIds === null) {
      seenIdsRef.current = jobIds;
      return;
    }

    const newlySeen = jobs
      .map((job) => job.id)
      .filter((id) => !seenIds.has(id));
    seenIdsRef.current = new Set([...seenIds, ...jobIds]);
    if (newlySeen.length === 0) return;

    setHighlighted((prev) => {
      const next = new Set(prev);
      for (const id of newlySeen) next.add(id);
      return next;
    });

    const timeout = window.setTimeout(() => {
      timersRef.current = timersRef.current.filter((timer) => timer !== timeout);
      setHighlighted((prev) => {
        const next = new Set(prev);
        for (const id of newlySeen) next.delete(id);
        return next;
      });
    }, 1500);
    timersRef.current = [...timersRef.current, timeout];
  }, [jobs]);

  useEffect(() => {
    return () => {
      for (const timer of timersRef.current) window.clearTimeout(timer);
      timersRef.current = [];
    };
  }, []);

  return (
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead>
        <tr style={{ textAlign: "left" }}>
          <th style={{ padding: 10, borderBottom: "1px solid #eee" }}>Job</th>
          <th style={{ padding: 10, borderBottom: "1px solid #eee" }}>Status</th>
          <th style={{ padding: 10, borderBottom: "1px solid #eee" }}>Type</th>
          <th style={{ padding: 10, borderBottom: "1px solid #eee" }}>Attempts</th>
          <th style={{ padding: 10, borderBottom: "1px solid #eee" }}>Created</th>
        </tr>
      </thead>

      <tbody>
        {jobs.map((j) => {
          const isNew = highlighted.has(j.id);

          return (
            <tr
              key={j.id}
              style={{
                background: isNew ? "#f3fff6" : "transparent",
                boxShadow: isNew ? "inset 0 0 0 1px #b7ebc6" : undefined,
                transition: "background-color 600ms ease, box-shadow 600 ms ease",
              }}
            >
              <td style={{ padding: 10, borderBottom: "1px solid #f2f2f2" }}>
                <Link to={`/jobs/${j.id}`}>
                  <code>{j.id}</code>
                </Link>
              </td>
              <td style={{ padding: 10, borderBottom: "1px solid #f2f2f2" }}>{j.status}</td>
              <td style={{ padding: 10, borderBottom: "1px solid #f2f2f2" }}>{j.type}</td>
              <td style={{ padding: 10, borderBottom: "1px solid #f2f2f2" }}>
                {j.attempts}/{j.max_attempts}
              </td>
              <td style={{ padding: 10, borderBottom: "1px solid #f2f2f2" }}>{fmt(j.created_at)}</td>
            </tr>
          );
        })}

        {jobs.length === 0 && (
          <tr>
            <td colSpan={5} style={{ padding: 12, color: "#666" }}>
              No jobs yet.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
