type Props = { status: string };

function styleFor(statusRaw: string): React.CSSProperties {
  const s = statusRaw.toLowerCase();

  // neutral defaults
  let bg = "#f3f4f6";
  let border = "#e5e7eb";
  let color = "#111827";

  if (["running"].includes(s)) {
    bg = "#ecfeff";
    border = "#a5f3fc";
    color = "#155e75";
  } else if (["succeeded", "success"].includes(s)) {
    bg = "#ecfdf5";
    border = "#a7f3d0";
    color = "#065f46";
  } else if (["failed", "error"].includes(s)) {
    bg = "#fef2f2";
    border = "#fecaca";
    color = "#7f1d1d";
  } else if (["retrying"].includes(s)) {
    bg = "#fffbeb";
    border = "#fde68a";
    color = "#92400e";
  } else if (["queued", "enqueued"].includes(s)) {
    bg = "#eff6ff";
    border = "#bfdbfe";
    color = "#1e40af";
  }

  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "4px 10px",
    borderRadius: 999,
    border: `1px solid ${border}`,
    background: bg,
    color,
    fontSize: 12,
    fontWeight: 600,
    whiteSpace: "nowrap",
  };
}

export function StatusChip({ status }: Props) {
  return <span style={styleFor(status)}>{status}</span>;
}
