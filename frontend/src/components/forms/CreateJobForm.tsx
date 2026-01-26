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


function onChangeType(next: string) {
  setType(next);
  const ex = executors.find((e) => e.name === next);
  if (ex?.payload_example != null) {
    setPayloadText(JSON.stringify(ex.payload_example, null, 2));
  }
}


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
        if (!type && data.length > 0) setType(data[0].name);
      } catch (e) {
        if (cancelled) return;
        setLoadError(e instanceof Error ? e.message : String(e));
      }
    }

    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const parsedPayload = useMemo(() => {
    try {
      return { ok: true as const, value: JSON.parse(payloadText) as unknown };
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : String(e) };
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

      <label style={{ display: "grid", gap: 6 }}>
        <span>Executor Type</span>
        <select
          value={type}
          onChange={(e) => onChangeType(e.target.value)}
          style={{ padding: 8 }}
        >
          {executors.map((ex) => (
            <option key={ex.name} value={ex.name}>
              {ex.name}
            </option>
          ))}
        </select>
      </label>

      <label style={{ display: "grid", gap: 6 }}>
        <span>Payload (JSON)</span>
        <textarea
          value={payloadText}
          onChange={(e) => setPayloadText(e.target.value)}
          rows={10}
          spellCheck={false}
          style={{ padding: 10, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}
        />
        {!parsedPayload.ok && (
          <span style={{ color: "#b00020" }}>JSON error: {parsedPayload.error}</span>
        )}
      </label>

      {submitError && (
        <div style={{ padding: 12, border: "1px solid #f2c2c2", background: "#fff5f5" }}>
          <strong>Submit failed:</strong> {submitError}
        </div>
      )}

      <button type="submit" disabled={submitting || !type || !parsedPayload.ok} style={{ padding: "10px 12px" }}>
        {submitting ? "Creating…" : "Create Job"}
      </button>
    </form>
  );
}

