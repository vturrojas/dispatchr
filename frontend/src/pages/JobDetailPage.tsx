import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router";
import { getJob, listJobEvents } from "../api/jobs";
import type { Job, JobEvent } from "../api/types";
import { useJobStream } from "../hooks/useJobStream";
import { useJobTimeline } from "../hooks/useJobTimeline";
import { StatusChip } from "../components/common/StatusChip";
import { CopyBlock } from "../components/common/CopyBlock";
import { AttemptedTimeline } from "../components/timeline/AttemptedTimeline";

function isTerminal(status?: string) {
  const s = (status ?? "").toLowerCase();
  return s === "succeeded" || s === "failed";
}

function msBetween(aIso?: string, bIso?: string) {
  if (!aIso || !bIso) return null;
  const a = Date.parse(aIso);
  const b = Date.parse(bIso);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, b - a);
}

function formatDuration(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export function JobDetailPage() {
  const { jobId } = useParams<"jobId">();
  if (!jobId) return <Navigate to="/404" replace />;

  return <JobDetail jobId={jobId} />;
}

function JobDetail({ jobId }: { jobId: string }) {
  const baseUrl = import.meta.env.VITE_API_BASE_URL as string;

  const [job, setJob] = useState<Job | null>(null);
  const [history, setHistory] = useState<JobEvent[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // Used to update "duration" every second while a job is in-flight
  const [nowTimestamp, setNowTimestamp] = useState(() => Date.now());

  useEffect(() => {
    if (isTerminal(job?.status)) return;
    const id = window.setInterval(() => setNowTimestamp(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [job?.status]);

  // Initial load: job first, events second (do not block UI on events failure)
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setErr(null);
        setLoading(true);

        const j = await getJob(jobId);
        if (cancelled) return;
        setJob(j);

        try {
          const ev = await listJobEvents(jobId);
          if (cancelled) return;
          setHistory(ev);
        } catch (e) {
          if (cancelled) return;
          setErr((prev) => prev ?? (e instanceof Error ? e.message : String(e)));
          setHistory([]);
        }
      } catch (e) {
        if (cancelled) return;
        setErr(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [jobId]);

  // Poll job until terminal so status updates without refresh
  useEffect(() => {
    let cancelled = false;

    async function tick() {
      try {
        const j = await getJob(jobId);
        if (!cancelled) setJob(j);
      } catch {
        // ignore transient polling errors
      }
    }

    const id = window.setInterval(() => {
      if (cancelled) return;
      if (isTerminal(job?.status)) return;
      tick();
    }, 2000);

    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [jobId, job?.status]);

  const lastHistoryId = useMemo(() => {
    return history && history.length ? history[history.length - 1].id : undefined;
  }, [history]);

  // Stream only while non-terminal
  const { streamEvents, connected, error: streamError } = useJobStream({
    jobId,
    baseUrl,
    fromId: lastHistoryId,
    enabled: !isTerminal(job?.status),
  });

  const timeline = useJobTimeline(history, streamEvents);

  const duration = useMemo(() => {
    const running = timeline.find((e) => e.event.toLowerCase() === "running");
    const terminal = timeline.find((e) => {
      const ev = e.event.toLowerCase();
      return ev === "succeeded" || ev === "failed";
    });

    if (!running) return null;

    if (terminal) {
      const ms = msBetween(running.created_at, terminal.created_at);
      return ms == null ? null : { label: formatDuration(ms), running: false };
    }

    const status = (job?.status ?? "").toLowerCase();
    const inFlight = status === "running" || status === "retrying" || status === "queued" || status === "enqueued";

    if (inFlight) {
      const ms = msBetween(running.created_at, new Date(nowTimestamp).toISOString());
      return ms == null ? null : { label: formatDuration(ms), running: true };
    }

    return null;
  }, [timeline, job?.status, nowTimestamp]);

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <p>
        <Link to="/jobs">← Back</Link>
      </p>

      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "grid", gap: 6 }}>
          <h1
            style={{
              margin: 0,
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <span>Job</span>
            <code style={{ fontSize: 16 }}>{jobId}</code>
            {job && <StatusChip status={job.status} />}
          </h1>

          {job && (
            <div
              style={{
                color: "#666",
                fontSize: 13,
                display: "flex",
                gap: 14,
                flexWrap: "wrap",
              }}
            >
              <span>
                <strong>Type:</strong> {job.type}
              </span>
              <span>
                <strong>Attempts:</strong> {job.attempts}/{job.max_attempts}
              </span>
              {duration && (
                <span>
                  <strong>Duration:</strong> {duration.label}
                  {duration.running ? " (running)" : ""}
                </span>
              )}
            </div>
          )}
        </div>

        <div style={{ fontSize: 13, color: "#666" }}>
          SSE:{" "}
          <strong>
            {isTerminal(job?.status)
              ? "stopped (terminal)"
              : connected
                ? "connected"
                : "disconnected"}
          </strong>
          {streamError ? ` • ${streamError}` : ""}
        </div>
      </div>

      {/* Error */}
      {err && (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            border: "1px solid #f2c2c2",
            background: "#fff5f5",
          }}
        >
          <strong>Error:</strong> {err}
        </div>
      )}

      {loading ? (
        <p style={{ marginTop: 16 }}>Loading…</p>
      ) : (
        <>
          {/* Job summary */}
          {job && (
            <div
              style={{
                marginTop: 16,
                padding: 12,
                border: "1px solid #eee",
                borderRadius: 10,
              }}
            >
              <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
                <div>
                  <strong>Status:</strong> {job.status}
                </div>
                <div>
                  <strong>Type:</strong> {job.type}
                </div>
                <div>
                  <strong>Attempts:</strong> {job.attempts}/{job.max_attempts}
                </div>
                {duration && (
                  <div>
                    <strong>Duration:</strong> {duration.label}
                    {duration.running ? " (running)" : ""}
                  </div>
                )}
              </div>

              <details style={{ marginTop: 10 }}>
                <summary style={{ cursor: "pointer" }}>payload</summary>
                <pre
                  style={{
                    marginTop: 8,
                    padding: 10,
                    background: "#f7f7f7",
                    overflowX: "auto",
                  }}
                >
                  <code>{JSON.stringify(job.payload, null, 2)}</code>
                </pre>
              </details>

              {job.last_error && (
                <details style={{ marginTop: 10 }}>
                  <summary style={{ cursor: "pointer", color: "#b00020" }}>
                    last_error
                  </summary>
                  <pre
                    style={{
                      marginTop: 8,
                      padding: 10,
                      background: "#fff5f5",
                      overflowX: "auto",
                    }}
                  >
                    <code>{job.last_error}</code>
                  </pre>
                </details>
              )}
            </div>
          )}

          {/* Developer tools */}
          {job && (
            <div style={{ marginTop: 16 }}>
              <h2 style={{ margin: "0 0 10px 0" }}>Developer tools</h2>
              <div style={{ display: "grid", gap: 12 }}>
                <CopyBlock
                  label="Fetch events"
                  text={`curl "${baseUrl}/jobs/${jobId}/events"`}
                />
                <CopyBlock
                  label="Tail stream (SSE)"
                  text={`curl -N "${baseUrl}/jobs/${jobId}/stream"`}
                />
                <CopyBlock
                  label="Resume stream from last event id"
                  text={`curl -N "${baseUrl}/jobs/${jobId}/stream?from_id=${
                    lastHistoryId ?? 0
                  }"`}
                />
              </div>
            </div>
          )}

          {/* Timeline */}
          <div style={{ marginTop: 16 }}>
            <h2 style={{ marginTop: 0 }}>Timeline</h2>

            {history && history.length === 0 ? (
              <div
                style={{
                  padding: 12,
                  border: "1px solid #eee",
                  borderRadius: 10,
                  color: "#666",
                }}
              >
                No events yet.
              </div>
            ) : (
              <AttemptedTimeline items={timeline} />
            )}
          </div>
        </>
      )}
    </div>
  );
}
