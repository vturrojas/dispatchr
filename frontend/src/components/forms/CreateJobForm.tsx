import { useEffect, useMemo, useState } from "react";
import type { Executor } from "../../api/types";
import { listExecutors } from "../../api/executors";

type Props = {
  onSubmit: (args: { type: string; payload: unknown }) => Promise<void>;
  submitting?: boolean;
};

const DEFAULT_PAYLOAD = `{
  "seconds": 2
}`;

export function CreateJobForm({ onSubmit, submitting }: Props) {
  const [executors, setExecutors] = useState<Executor[]>([]);
  const [type, setType] = useState<string>("");
  const [payloadText, setPayloadText] = useState<string>(DEFAULT_PAYLOAD);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoadError(null);
        const data = await listExecutors();
        if (cancelled) return;

        setExecutors(data);

        // default to first executor
        if (data.length > 0) {
          const first = data[0];
          setType(first.name);

          // preload payload example if provided
          if (first.payload_example != null) {
            setPayloadText(JSON.stringify(first.payload_example, null, 2));
          }
        }
      } catch (e) {
        if (cancelled) return;
        setLoadError(e instanceof Error ? e.message : String(e));
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  function onChangeType(next: string) {
    setType(next);
    const ex = executors.find((e) => e.name === next);
    if (ex?.payload_example != null) {
      setPayloadText(JSON.stringify(ex.payload_example, null, 2));
    }
  }

  const parsedPayload = useMemo(() => {
    try {
      return { ok: true as const, value: JSON.parse(payloadText) as unknown };
    } catch (e) {
      return {
        ok: false as const,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }, [payloadText]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    if (!type) {
      setSubmitError("Please select an executor type.");
      return;
    }
    if (!parsedPayload.ok) {
      setSubmitError(`Invalid JSON payload: ${parsedPayload.error}`);
      return;
    }

    try {
      await onSubmit({ type, payload: parsedPayload.value });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
      {loadError && (
        <div style={{ padding: 12, border: "1px solid #f2c2c2", background: "#fff5f5" }}>
          <strong>Failed to load executors:</strong> {loadError}
        </div>
      )}

      <div style={{ display: "grid", gap: 6 }}>
        <span>Executor Type</span>

        {executors.length === 0 ? (
          <div style={{ padding: 10, border: "1px solid #eee", borderRadius: 10, color: "#666" }}>
            No executors returned by API.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {executors.map((ex) => {
              const selected = ex.name === type;
              return (
                <button
                  key={ex.name}
                  type="button"
                  onClick={() => onChangeType(ex.name)}
                  style={{
                    textAlign: "left",
                    padding: 10,
                    borderRadius: 10,
                    border: selected ? "2px solid #111" : "1px solid #eee",
                    background: selected ? "#f7f7f7" : "white",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <strong>{ex.name}</strong>
                    {selected && <span style={{ fontSize: 12, color: "#666" }}>selected</span>}
                  </div>
                  {ex.description && (
                    <div style={{ marginTop: 6, color: "#666", fontSize: 13 }}>{ex.description}</div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <label style={{ display: "grid", gap: 6 }}>
        <span>Payload (JSON)</span>
        <textarea
          value={payloadText}
          onChange={(e) => setPayloadText(e.target.value)}
          rows={10}
          spellCheck={false}
          style={{
            padding: 10,
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            borderRadius: 10,
            border: "1px solid #eee",
          }}
        />
        {!parsedPayload.ok && <span style={{ color: "#b00020" }}>JSON error: {parsedPayload.error}</span>}
      </label>

      {submitError && (
        <div style={{ padding: 12, border: "1px solid #f2c2c2", background: "#fff5f5" }}>
          <strong>Submit failed:</strong> {submitError}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting || !type || !parsedPayload.ok}
        style={{ padding: "10px 12px", borderRadius: 10 }}
      >
        {submitting ? "Creating…" : "Create Job"}
      </button>
    </form>
  );
}
