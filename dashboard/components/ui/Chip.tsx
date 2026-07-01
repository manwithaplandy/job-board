export interface ChipProps {
  children: React.ReactNode;
  color?: string;
  bg?: string;
  border?: string;
}

export function Chip({ children, color = "#566", bg = "#fff", border = "#e7eaf0" }: ChipProps) {
  return (
    <span
      style={{
        fontSize: "11px",
        fontWeight: 600,
        color,
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: "7px",
        padding: "2px 8px",
        display: "inline-flex",
        alignItems: "center",
      }}
    >
      {children}
    </span>
  );
}
