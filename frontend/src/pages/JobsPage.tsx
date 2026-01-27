import { Link } from "react-router-dom";
import { useMemo, useState } from "react";
import { useJobs } from "../hooks/useJobs";
import { JobsTable } from "../components/jobs/JobsTable";
import type { Job } from "../api/types";

function countByStatus(jobs: Job[]) {
  const counts: Record<string, number> = {};
  for (const j of jobs) {
    counts[j.status] = (counts[j.status] ?? 0) + 1;
  }
  return counts;
}

function Metric({
  label,
  value,
  danger,
}: {
  label: string;
  value: number;
  danger?: boolean;
}) {
  return (
    <div
      style={{
        padding: 12,
        border: "1px solid #eee",
        borderRadius: 12,
        background: danger ? "#fff5f5" : "white",
      }}
    >
      <div style={{ fontSize: 12, color: "#666" }}>{label}</div>
      <div
        style={{
          marginTop: 6,
          fontSize: 22,
          fontWeight: 600,
          color: danger ? "#b00020" : "#111",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      // Clipboard can fail in some browsers; do nothing noisy.
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      style={{
        padding: "10px 12px",
        border: "1px solid #ddd",
        borderRadius: 10,
        background: "white",
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      {copied ? "✅ Copied" : "📋 Copy"} <span style={{ color: "#666" }}>{label}</span>
    </button>
  );
}

function EmptyState() {
  const baseUrl = import.meta.env.VITE_API_BASE_URL as string;

  const curl = `curl -sS -X POST "${baseUrl}/jobs" \\
  -H "Content-Type: application/json" \\
  -d '{"type":"sleep","payload":{"seconds":2}}' | cat`;

  return (
    <div
      style={{
        marginTop: 16,
        padding: 18,
        border: "1px solid #eee",
        borderRadius: 14,
        background: "white",
      }}
    >
      <div style={{ display: "grid", gap: 8 }}>
        <h2 style={{ margin: 0 }}>No jobs yet</h2>
        <div style={{ color: "#666" }}>
          DispatchR is an automation runner with a <strong>durable event journal</strong> and{" "}
          <strong>live SSE streaming</strong> — so you can answer “did it run?” without building an ops platform.
        </div>
      </div>

      <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Link
          to="/jobs/new"
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            background: "#111",
            color: "white",
            textDecoration: "none",
          }}
        >
          ➕ Create your first job
        </Link>

        <CopyButton text={curl} label="curl example (sleep 2s)" />
      </div>

      <details style={{ marginTop: 14 }}>
        <summary style={{ cursor: "pointer" }}>Why DispatchR?</summary>
        <div style={{ marginTop: 10, color: "#444", display: "grid", gap: 8 }}>
          <div>✅ Durable audit log (append-only events)</div>
          <div>✅ Explicit lifecycle transitions (created → queued → running → …)</div>
          <div>✅ Tail live events like <code>tail -f</code> via SSE</div>
          <div>✅ Compose deploy: API + scheduler + worker + Redis + Postgres</div>
        </div>
      </details>
    </div>
  );
}

export function JobsPage() {
  const { jobs, loading, error } = useJobs(3000);

  const metrics = useMemo(() => {
    if (!jobs) return null;
    const c = countByStatus(jobs);

    return {
      running: c.running ?? 0,
      queued: (c.queued ?? 0) + (c.enqueued ?? 0),
      succeeded: c.succeeded ?? 0,
      failed: c.failed ?? 0,
      total: jobs.length,
    };
  }, [jobs]);

  const hasJobs = !!jobs && jobs.length > 0;

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <h1 style={{ margin: 0 }}>DispatchR — Jobs</h1>
        <Link to="/jobs/new">Create job</Link>
      </div>

      {error && (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            border: "1px solid #f2c2c2",
            background: "#fff5f5",
          }}
        >
          <strong>API error:</strong> {error}
          <div style={{ marginTop: 6, color: "#666" }}>
            Check <code>VITE_API_BASE_URL</code> in <code>.env.local</code>.
          </div>
        </div>
      )}

      {/* Metrics row */}
      {metrics && (
        <div
          style={{
            marginTop: 16,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: 12,
          }}
        >
          <Metric label="Running" value={metrics.running} />
          <Metric label="Queued" value={metrics.queued} />
          <Metric label="Succeeded" value={metrics.succeeded} />
          <Metric label="Failed" value={metrics.failed} danger />
          <Metric label="Total" value={metrics.total} />
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        {loading ? (
          <p>Loading…</p>
        ) : hasJobs ? (
          <JobsTable jobs={jobs} />
        ) : (
          <EmptyState />
        )}
      </div>
    </div>
  );
}
