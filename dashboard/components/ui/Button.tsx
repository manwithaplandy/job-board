import type { ButtonHTMLAttributes, CSSProperties } from "react";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md";
}

// Tokens copied verbatim from the board's canonical CTAs so adopting <Button> is a
// no-op visually: `primary`+`md` is the big "Generate résumé" / "Prepare" button
// (ResumePanel), `secondary` is the outline "Copy"/"Regenerate", `sm` is the compact
// "Download PDF" footprint. Sites that differ pass the delta via `style`.
export function Button({
  variant = "primary",
  size = "md",
  style,
  ...props
}: ButtonProps) {
  const base: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    fontFamily: "inherit",
    fontWeight: 700,
    cursor: props.disabled ? "not-allowed" : "pointer",
    opacity: props.disabled ? 0.7 : 1,
    border: variant === "secondary" ? "1px solid var(--border)" : "none",
    borderRadius: size === "sm" ? "10px" : "11px",
    fontSize: size === "sm" ? "13.5px" : "14px",
    padding: size === "sm" ? "10px 16px" : "12px 20px",
    ...(variant === "primary" && {
      background: "var(--accent)",
      color: "var(--text-on-accent)",
      boxShadow: "var(--shadow-accent)",
    }),
    ...(variant === "secondary" && {
      background: "var(--bg-surface)",
      color: "var(--text-secondary)",
    }),
    ...(variant === "ghost" && {
      background: "transparent",
      color: "var(--accent)",
    }),
    ...style,
  };
  return <button type="button" style={base} {...props} />;
}
