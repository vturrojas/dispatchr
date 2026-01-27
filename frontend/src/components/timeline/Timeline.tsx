import { useEffect, useMemo, useRef, useState } from "react";
import type { TimelineItem } from "../../hooks/useJobTimeline";

function fmt(iso: string) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return iso;
  return new Date(t).toLocaleString();
}

function prettyJson(v: unknown) {
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}


function iconFor(event: string) {
  const e = event.toLowerCase();
  if (e === "running") return "▶️";
  if (e === "succeeded") return "✅";
  if (e === "failed") return "❌";
  if (e === "retrying") return "🔁";
  if (e === "queued" || e === "enqueued") return "⏳";
  return "•";
}


export function Timeline({ items }: { items: TimelineItem[] }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const [autoFollow, setAutoFollow] = useState(true);

  // Detect user scrolling up (pause auto-follow)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    function onScroll() {
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      // if user is near bottom, keep following
      setAutoFollow(distanceFromBottom < 80);
    }

    el.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  // When items change, scroll to bottom if auto-follow is on
  const lastKey = useMemo(() => (items.length ? items[items.length - 1].key : ""), [items]);

  useEffect(() => {
    if (!autoFollow) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [lastKey, autoFollow]);

  return (
    <div>
      {!autoFollow && (
        <div
          style={{
            position: "sticky",
            top: 0,
            zIndex: 10,
            marginBottom: 10,
            padding: 10,
            border: "1px solid #ffe08a",
            background: "#fff9db",
            borderRadius: 10,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div style={{ fontSize: 13 }}>
            <strong>Paused</strong> — you scrolled up. New events may arrive below.
          </div>
          <button
            type="button"
            onClick={() => {
              setAutoFollow(true);
              bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
            }}
            style={{ padding: "6px 10px" }}
          >
            Jump to latest
          </button>
        </div>
      )}

      <div
        ref={containerRef}
        style={{
          maxHeight: 520,
          overflow: "auto",
          paddingRight: 6,
          display: "grid",
          gap: 10,
        }}
      >
        {items.map((it) => (
          <div
            key={it.key}
            style={{
              border: "1px solid #eee",
              borderRadius: 10,
              padding: 12,
              background: it.source === "live" ? "#f7fffb" : "white",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
                <strong>{iconFor(it.event)} {it.event}</strong>
                <span style={{ fontSize: 12, color: "#666" }}>
                  {it.source === "live" ? "live" : "history"}
                  {typeof it.id === "number" ? ` • id ${it.id}` : ""}
                </span>
              </div>
              <span style={{ fontSize: 12, color: "#666" }}>{fmt(it.created_at)}</span>
            </div>

            {it.message && <div style={{ marginTop: 8 }}>{it.message}</div>}

            {it.data != null && (
              <details style={{ marginTop: 10 }}>
                <summary style={{ cursor: "pointer" }}>data</summary>
                <pre style={{ marginTop: 8, padding: 10, background: "#f7f7f7", overflowX: "auto" }}>
                  <code>{prettyJson(it.data)}</code>
                </pre>
              </details>
            )}
          </div>
        ))}

        {items.length === 0 && <div style={{ color: "#666" }}>No events yet.</div>}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
