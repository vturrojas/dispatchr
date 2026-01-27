import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { listJobs } from "../api/jobs";
import type { Job } from "../api/types";
import { StatusChip } from "../components/common/StatusChip";

function fmtIso(iso?: string) {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return iso;
  return new Date(t).toLocaleString();
}

function normalize(s: string) {
  return s.trim().toLowerCase();
}

export function JobsPage() {
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [polling, setPolling] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  // UI state
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [failedOnly, setFailedOnly] = useState(false);
  const [query, setQuery] = useState("");

  const visible = usePageVisibility();

  const types = useMemo(() => {
    const set = new Set<string>();
    (jobs ?? []).forEach((j) => set.add(j.type));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [jobs]);

  const statuses = useMemo(() => {
    const set = new Set<string>();
    (jobs ?? []).forEach((j) => set.add(j.status));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [jobs]);

  const filtered = useMemo(() => {
    const q = normalize(query);

    return (jobs ?? [])
      .filter((j) => (statusFilter === "all" ? true : j.status === statusFilter))
      .filter((j) => (typeFilter === "all" ? true : j.type === typeFilter))
      .filter((j) => (failedOnly ? j.status === "failed" : true))
      .filter((j) => {
        if (!q) return true;
        return normalize(j.id).includes(q);
      });
  }, [jobs, statusFilter, typeFilter, failedOnly, query]);

  async function loadOnce(opts?: { silent?: boolean }) {
    const silent = opts?.silent ?? false;

    try {
      setErr(null);
      if (!silent) setLoading(true);
      setPolling(silent);

      const data = await listJobs();
      setJobs(data);
      setLastUpdated(new Date().toISOString());
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
      setPolling(false);
    }
  }

  // Initial load
  useEffect(() => {
    loadOnce({ silent: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Poll every 2.5s, but ONLY when tab is visible
  useEffect(() => {
    if (!visible) return;

    const id = window.setInterval(() => {
      loadOnce({ silent: true });
    }, 2500);

    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

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
        <div>
          <h1 style={{ margin: 0 }}>DispatchR — Jobs</h1>
          <div style={{ marginTop: 6, fontSize: 13, color: "#666", display: "flex", gap: 10, flexWrap: "wrap" }}>
            <span>
              {loading ? "Loading…" : polling ? "Updating…" : "Up to date"}
            </span>
            {lastUpdated && <span>• Last updated {fmtIso(lastUpdated)}</span>}
            {!visible && <span>• Paused (tab hidden)</span>}
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button
            type="button"
            onClick={() => loadOnce({ silent: false })}
            style={{ padding: "8px 12px" }}
            disabled={loading}
          >
            Refresh
          </button>

          <Link
            to="/jobs/new"
            style={{
              padding: "8px 12px",
              background: "#111",
              color: "white",
              borderRadius: 10,
              textDecoration: "none",
            }}
          >
            Create job
          </Link>
        </div>
      </div>

      {err && (
        <div style={{ marginTop: 14, padding: 12, border: "1px solid #f2c2c2", background: "#fff5f5" }}>
          <strong>API error:</strong> {err}
          <div style={{ marginTop: 8, fontSize: 13, color: "#666" }}>
            Check <code>VITE_API_BASE_URL</code> in <code>.env.local</code>.
          </div>
        </div>
      )}

      {/* Filters */}
      <div
        style={{
          marginTop: 16,
          padding: 12,
          border: "1px solid #eee",
          borderRadius: 12,
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <div style={{ display: "grid", gap: 6 }}>
          <label style={{ fontSize: 12, color: "#666" }}>Search job id</label>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. 17fc…"
            style={{ padding: "8px 10px", minWidth: 240 }}
          />
        </div>

        <div style={{ display: "grid", gap: 6 }}>
          <label style={{ fontSize: 12, color: "#666" }}>Status</label>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ padding: "8px 10px" }}>
            <option value="all">All</option>
            {statuses.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "grid", gap: 6 }}>
          <label style={{ fontSize: 12, color: "#666" }}>Type</label>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={{ padding: "8px 10px" }}>
            <option value="all">All</option>
            {types.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 18 }}>
          <input type="checkbox" checked={failedOnly} onChange={(e) => setFailedOnly(e.target.checked)} />
          Failed only
        </label>

        <div style={{ marginLeft: "auto", fontSize: 13, color: "#666", marginTop: 18 }}>
          Showing <strong>{filtered.length}</strong> of <strong>{jobs?.length ?? 0}</strong>
        </div>
      </div>

      {/* Table / Empty state */}
      <div style={{ marginTop: 16 }}>
        {loading && !jobs ? (
          <p>Loading…</p>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 18, border: "1px solid #eee", borderRadius: 12, color: "#666" }}>
            <div style={{ fontSize: 16, color: "#111", fontWeight: 600 }}>No jobs yet.</div>
            <div style={{ marginTop: 6 }}>Create a job to see durable history + live streaming timeline.</div>
            <div style={{ marginTop: 12 }}>
              <Link
                to="/jobs/new"
                style={{
                  display: "inline-block",
                  padding: "10px 14px",
                  background: "#111",
                  color: "white",
                  borderRadius: 10,
                  textDecoration: "none",
                }}
              >
                Create your first job
              </Link>
            </div>
          </div>
        ) : (
          <div style={{ border: "1px solid #eee", borderRadius: 12, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#fafafa" }}>
                  <th style={th}>Job</th>
                  <th style={th}>Status</th>
                  <th style={th}>Type</th>
                  <th style={th}>Attempts</th>
                  <th style={th}>Created</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((j) => (
                  <tr key={j.id} style={{ borderTop: "1px solid #eee" }}>
                    <td style={td}>
                      <Link to={`/jobs/${j.id}`} style={{ textDecoration: "none" }}>
                        <code style={{ fontSize: 13 }}>{j.id}</code>
                      </Link>
                    </td>
                    <td style={td}>
                      <StatusChip status={j.status} />
                    </td>
                    <td style={td}>
                      <code style={{ fontSize: 13 }}>{j.type}</code>
                    </td>
                    <td style={td}>
                      {j.attempts}/{j.max_attempts}
                    </td>
                    <td style={td}>{fmtIso(j.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 12px",
  fontSize: 12,
  color: "#666",
};

const td: React.CSSProperties = {
  padding: "10px 12px",
  verticalAlign: "top",
};

function usePageVisibility() {
  const [visible, setVisible] = useState(() => document.visibilityState === "visible");

  useEffect(() => {
    const onVis = () => setVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  return visible;
}
