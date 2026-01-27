import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createJob } from "../api/jobs";
import { CreateJobForm } from "../components/forms/CreateJobForm";
import { optimisticUpsertJob } from "../hooks/useJobs";

type Toast =
  | { kind: "info"; message: string }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string }
  | null;

function ToastBanner({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  if (!toast) return null;

  const styles =
    toast.kind === "success"
      ? { border: "1px solid #b7ebc6", background: "#f3fff6" }
      : toast.kind === "error"
        ? { border: "1px solid #f2c2c2", background: "#fff5f5" }
        : { border: "1px solid #d9d9d9", background: "#f7f7f7" };

  const color =
    toast.kind === "success"
      ? "#0f5132"
      : toast.kind === "error"
        ? "#b00020"
        : "#333";

  return (
    <div
      style={{
        marginTop: 12,
        padding: 12,
        borderRadius: 12,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        gap: 12,
        ...styles,
      }}
      role="status"
      aria-live="polite"
    >
      <div style={{ color }}>
        {toast.kind === "success" ? "✅ " : toast.kind === "error" ? "❌ " : "ℹ️ "}
        {toast.message}
      </div>
      <button
        type="button"
        onClick={onClose}
        style={{
          border: "none",
          background: "transparent",
          cursor: "pointer",
          color: "#666",
          fontSize: 14,
        }}
        aria-label="Dismiss"
        title="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}

export function CreateJobPage() {
  const navigate = useNavigate();

  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<Toast>(null);

  // Prevent double submits from racing
  const inFlightRef = useRef(false);

  // Track timeout IDs so we can clean up on unmount
  const clearToastTimerRef = useRef<number | null>(null);
  const navigateTimerRef = useRef<number | null>(null);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (clearToastTimerRef.current) window.clearTimeout(clearToastTimerRef.current);
      if (navigateTimerRef.current) window.clearTimeout(navigateTimerRef.current);
    };
  }, []);

  // Auto-clear success/info toasts after a bit (errors stay)
  useEffect(() => {
    if (!toast) return;
    if (toast.kind === "error") return;

    if (clearToastTimerRef.current) window.clearTimeout(clearToastTimerRef.current);
    clearToastTimerRef.current = window.setTimeout(() => setToast(null), 2500);

    return () => {
      if (clearToastTimerRef.current) window.clearTimeout(clearToastTimerRef.current);
      clearToastTimerRef.current = null;
    };
  }, [toast]);

  async function handleSubmit(args: { type: string; payload: unknown }) {
    if (inFlightRef.current) return;

    inFlightRef.current = true;
    setSubmitting(true);
    setToast({ kind: "info", message: "Creating job…" });

    try {
      const job = await createJob(args);

      // Optimistically insert into the Jobs dashboard cache immediately
      // (Dashboard polling will reconcile status changes shortly after.)
      optimisticUpsertJob(job);

      setToast({ kind: "success", message: "Job created — opening details…" });

      // Give the user a beat to see the success state
      if (navigateTimerRef.current) window.clearTimeout(navigateTimerRef.current);
      navigateTimerRef.current = window.setTimeout(() => {
        navigate(`/jobs/${job.id}`);
      }, 250);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setToast({ kind: "error", message: msg });
    } finally {
      setSubmitting(false);
      inFlightRef.current = false;
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <p>
        <Link to="/jobs">← Back</Link>
      </p>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <h1 style={{ margin: 0 }}>Create Job</h1>
        <div style={{ fontSize: 13, color: "#666" }}>
          Tip: use <code>sleep</code> to validate timeline streaming
        </div>
      </div>

      <ToastBanner toast={toast} onClose={() => setToast(null)} />

      <div style={{ marginTop: 16 }}>
        <CreateJobForm onSubmit={handleSubmit} submitting={submitting} />
      </div>
    </div>
  );
}
