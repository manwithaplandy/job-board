export interface PanelProps {
  children: React.ReactNode;
  style?: React.CSSProperties;
}

export function Panel({ children, style }: PanelProps) {
  return (
    <div
      style={{
        border: "1px solid #e3e7ee",
        borderRadius: "16px",
        padding: "19px 20px",
        ...style,
      }}
    >
      {children}
    </div>
  );
}
