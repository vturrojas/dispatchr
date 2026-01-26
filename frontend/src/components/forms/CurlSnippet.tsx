import { useMemo, useState } from "react";

type Props = {
  type: string;
  payloadText: string; // raw JSON text
};

export function CurlSnippet({ type, payloadText }: Props) {
  const [copied, setCopied] = useState(false);

  const baseUrl = import.meta.env.VITE_API_BASE_URL as string;

  const curl = useMemo(() => {
    // keep it readable; payloadText is already JSON string
    return `curl -X POST "${baseUrl}/jobs" \\
  -H "Content-Type: application/json" \\
  -d '{"type":"${type}","payload":${payloadText}}'`;
  }, [baseUrl, payloadText, type]);

  async function copy() {
    await navigator.clipboard.writeText(curl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <strong>Copy curl</strong>
        <button type="button" onClick={copy} style={{ padding: "6px 10px" }}>
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre style={{ margin: 0, padding: 12, background: "#f7f7f7", overflowX: "auto" }}>
        <code>{curl}</code>
      </pre>
    </div>
  );
}
