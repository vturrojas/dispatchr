type Props = { status: string };

export function StatusChip({ status }: Props) {
  const s = status?.toLowerCase?.() ?? "unknown";

  const style: React.CSSProperties = {
    display: "inline-block",
    padding: "2px 10px",
    borderRadius: 999,
    fontSize: 12,
    border: "1px solid #ddd",
    background: "#f7f7f7",
  };

  return <span style={style}>{s}</span>;
}
