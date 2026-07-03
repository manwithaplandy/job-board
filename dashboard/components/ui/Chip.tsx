export interface ChipProps {
  children: React.ReactNode;
  color?: string;
  bg?: string;
  border?: string;
  style?: React.CSSProperties;
}

// Default text color darkened from the old "#566" (~3.1:1 on #fff) to #5d6673, which
// clears 4.5:1 at the 11px chip size. Sites that differ (pill radius, weight, padding)
// pass the delta via `style`, which merges last — same convention as Button/Panel.
export function Chip({ children, color = "#5d6673", bg = "#fff", border = "#e7eaf0", style }: ChipProps) {
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
        ...style,
      }}
    >
      {children}
    </span>
  );
}
