import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { Job } from "../../api/types";

function fmt(iso: string) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return iso;
  return new Date(t).toLocaleString();
}

export function JobsTable({ jobs }: { jobs: Job[] }) {
  const [highlighted, setHighlighted] = useState<Set<string>>(new Set());
  const seenIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!jobs || jobs.length === 0) return;

    const newlySeen: string[] = [];
    for (const j of jobs) {
      if (!seenIdsRef.current.has(j.id)) {
        seenIdsRef.current.add(j.id);
        newlySeen.push(j.id);
      }
    }
    if (newlySeen.length === 0) return;

    // Add highlights
    setHighlighted((prev) => {
      const next = new Set(prev);
      for (const id of newlySeen) next.add(id);
      return next;
    });

    // Remove highlights after a short delay
    const timeout = window.setTimeout(() => {
      setHighlighted((prev) => {
        const next = new Set(prev);
        for (const id of newlySeen) next.delete(id);
        return next;
      });
    }, 1500);

    return () => window.clearTimeout(timeout);
  }, [jobs]);

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
