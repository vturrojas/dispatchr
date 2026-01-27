import { useMemo, useState } from "react";
import type { TimelineItem } from "../../hooks/useJobTimeline";
import { Timeline } from "./Timeline";

function iconFor(event: string) {
  const e = event.toLowerCase();
  if (e === "running") return "▶️";
  if (e === "succeeded") return "✅";
  if (e === "failed") return "❌";
  if (e === "retrying") return "🔁";
  if (e === "queued" || e === "enqueued") return "⏳";
  if (e === "created") return "🆕";
  return "•";
}

function fmt(iso: string) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return iso;
  return new Date(t).toLocaleString();
}

function fmtDuration(ms: number) {
  if (!Number.isFinite(ms) || ms < 0) return "";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rs = s % 60;
  if (m < 60) return `${m}m ${rs}s`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return `${h}h ${rm}m`;
}

// Heuristic: attempt number appears in messages like:
// "Worker started attempt 1"
function extractAttemptFromMessage(msg?: string | null): number | null {
  if (!msg) return null;
  const m = msg.match(/attempt\s+(\d+)/i);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

// Assign attempt number to each event.
// Rules:
// - before we ever see an explicit attempt, everything is attempt 0 ("Pre-run")
// - when we see "attempt N", current attempt becomes N
// - subsequent events inherit that attempt until another "attempt N" appears
function assignAttempts(items: TimelineItem[]) {
  let currentAttempt = 0;

  return items.map((it) => {
    const explicit = extractAttemptFromMessage(it.message);
    if (explicit != null) currentAttempt = explicit;

    return {
      ...it,
      _attempt: currentAttempt,
      _explicitAttempt: explicit != null,
    };
  });
}

type AttemptGroup = {
  attempt: number; // 0 = pre-run
  items: TimelineItem[];

  // For header
  startedAt?: string; // running time (if present)
  endedAt?: string; // succeeded/failed time (if present)
  endEvent?: string; // succeeded/failed etc

  // For duration
  durationMs?: number;
};

function groupByAttempt(items: TimelineItem[]): AttemptGroup[] {
  const withAttempts = assignAttempts(items) as (TimelineItem & { _attempt: number })[];

  const map = new Map<number, AttemptGroup>();

  for (const it of withAttempts) {
    const a = it._attempt;
    const g =
      map.get(a) ??
      ({
        attempt: a,
        items: [],
      } as AttemptGroup);

    g.items.push(it);

    const ev = it.event.toLowerCase();

    // Track attempt "start": prefer running timestamp
    if (ev === "running") {
      g.startedAt = g.startedAt ?? it.created_at;
    }

    // Track attempt "end": succeeded/failed timestamp
    if (ev === "succeeded" || ev === "failed") {
      g.endedAt = it.created_at;
      g.endEvent = it.event;
    }

    map.set(a, g);
  }

  const groups = Array.from(map.values()).sort((a, b) => a.attempt - b.attempt);

  // Compute duration: prefer running→terminal, else fallback to first→last event
  for (const g of groups) {
    const startIso =
      g.startedAt ??
      (g.items.length ? g.items[0].created_at : undefined);

    const endIso =
      g.endedAt ??
      (g.items.length ? g.items[g.items.length - 1].created_at : undefined);

    const startMs = startIso ? Date.parse(startIso) : NaN;
    const endMs = endIso ? Date.parse(endIso) : NaN;

    if (Number.isFinite(startMs) && Number.isFinite(endMs) && endMs >= startMs) {
      g.durationMs = endMs - startMs;
    }
  }

  return groups;
}

function attemptLabel(n: number) {
  return n === 0 ? "Pre-run" : `Attempt ${n}`;
}

function headerSummary(g: AttemptGroup) {
  if (g.endEvent) return `${iconFor(g.endEvent)} ${g.endEvent}`;
  const hasRetrying = g.items.some((i) => i.event.toLowerCase() === "retrying");
  if (hasRetrying) return `${iconFor("retrying")} retrying`;
  const hasRunning = g.items.some((i) => i.event.toLowerCase() === "running");
  if (hasRunning) return `${iconFor("running")} running`;
  return `${iconFor(g.items[g.items.length - 1]?.event ?? "")} in progress`;
}

export function AttemptedTimeline({ items }: { items: TimelineItem[] }) {
  if (!items || items.length === 0) return <Timeline items={items} />;

  const groups = useMemo(() => groupByAttempt(items), [items]);

  // If we never detected an attempt > 0, grouping isn’t helpful.
  const maxAttempt = useMemo(
    () => Math.max(...groups.map((g) => g.attempt)),
    [groups]
  );
  if (maxAttempt <= 0) return <Timeline items={items} />;

  const latestAttempt = maxAttempt;
  const [collapseAttempts, setCollapseAttempts] = useState(true);

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="checkbox"
            checked={collapseAttempts}
            onChange={(e) => setCollapseAttempts(e.target.checked)}
          />
          Collapse attempts
        </label>

        <div style={{ fontSize: 12, color: "#666" }}>
          Grouped by attempt (derived from worker messages)
        </div>
      </div>

      {groups.map((g) => {
        const isLatest = g.attempt === latestAttempt;
        const defaultOpen = !collapseAttempts || isLatest;

        const timeBits: string[] = [];

        if (g.startedAt) timeBits.push(`start ${fmt(g.startedAt)}`);
        if (g.endedAt) timeBits.push(`end ${fmt(g.endedAt)}`);

        const durationBit = g.durationMs != null ? `dur ${fmtDuration(g.durationMs)}` : "";
        if (durationBit) timeBits.push(durationBit);

        return (
          <details
            key={`attempt-${g.attempt}`}
            open={defaultOpen}
            style={{
              border: "1px solid #eee",
              borderRadius: 12,
              padding: 10,
              background: isLatest ? "#fcfcff" : "white",
            }}
          >
            <summary
              style={{
                cursor: "pointer",
                listStyle: "none",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <div style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
                <strong>{attemptLabel(g.attempt)}</strong>
                <span style={{ fontSize: 12, color: "#666" }}>
                  {headerSummary(g)}
                </span>
              </div>

              <span style={{ fontSize: 12, color: "#666" }}>
                {timeBits.length ? timeBits.join(" • ") : ""}
              </span>
            </summary>

            <div style={{ marginTop: 10 }}>
              <Timeline items={g.items} />
            </div>
          </details>
        );
      })}
    </div>
  );
}
