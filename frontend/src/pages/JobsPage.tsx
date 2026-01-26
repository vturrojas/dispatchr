import { Link } from "react-router-dom";
import { useJobs } from "../hooks/useJobs";
import { JobsTable } from "../components/jobs/JobsTable";

export function JobsPage() {
  const { jobs, loading, error } = useJobs(3000);

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h1 style={{ margin: 0 }}>DispatchR — Jobs</h1>
        <Link to="/jobs/new">Create job</Link>
      </div>

      {error && (
        <div style={{ marginTop: 12, padding: 12, border: "1px solid #f2c2c2", background: "#fff5f5" }}>
          <strong>API error:</strong> {error}
          <div style={{ marginTop: 6, color: "#666" }}>
            Check <code>VITE_API_BASE_URL</code> in <code>.env.local</code>.
          </div>
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        {loading ? <p>Loading…</p> : <JobsTable jobs={jobs} />}
      </div>
    </div>
  );
}
