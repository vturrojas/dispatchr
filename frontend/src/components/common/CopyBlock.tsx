import { useState } from "react";

export function CopyBlock({ label, text }: { label: string; text: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 900);
  }

  return (
    <div style={{ border: "1px solid #eee", borderRadius: 10, padding: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
        <strong>{label}</strong>
        <button type="button" onClick={copy} style={{ padding: "6px 10px" }}>
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre style={{ marginTop: 10, padding: 10, background: "#f7f7f7", overflowX: "auto" }}>
        <code>{text}</code>
      </pre>
    </div>
  );
}
