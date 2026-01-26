import { Link } from "react-router-dom";
import type { Job } from "../../api/types";

function fmt(iso: string) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return iso;
  return new Date(t).toLocaleString();
}

export function JobsTable({ jobs }: { jobs: Job[] }) {
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
        {jobs.map((j) => (
          <tr key={j.id}>
            <td style={{ padding: 10, borderBottom: "1px solid #f2f2f2" }}>
              <Link to={`/jobs/${j.id}`}><code>{j.id}</code></Link>
            </td>
            <td style={{ padding: 10, borderBottom: "1px solid #f2f2f2" }}>{j.status}</td>
            <td style={{ padding: 10, borderBottom: "1px solid #f2f2f2" }}>{j.type}</td>
            <td style={{ padding: 10, borderBottom: "1px solid #f2f2f2" }}>
              {j.attempts}/{j.max_attempts}
            </td>
            <td style={{ padding: 10, borderBottom: "1px solid #f2f2f2" }}>{fmt(j.created_at)}</td>
          </tr>
        ))}
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
