import type { ButtonHTMLAttributes } from "react";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
}

export function Button({
  variant = "primary",
  size = "md",
  style,
  ...props
}: ButtonProps) {
  const base: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "inherit",
    fontWeight: 700,
    cursor: props.disabled ? "not-allowed" : "pointer",
    opacity: props.disabled ? 0.6 : 1,
    border: "none",
    borderRadius: size === "sm" ? "8px" : size === "lg" ? "12px" : "10px",
    fontSize: size === "sm" ? "12px" : size === "lg" ? "15px" : "13.5px",
    padding: size === "sm" ? "6px 12px" : size === "lg" ? "13px 24px" : "10px 18px",
    ...(variant === "primary" && {
      background: "#3b6fd4",
      color: "#fff",
      boxShadow: "0 3px 10px rgba(59,111,212,.26)",
    }),
    ...(variant === "secondary" && {
      background: "#fff",
      color: "#5b6472",
      border: "1px solid #dfe3ea",
    }),
    ...(variant === "ghost" && {
      background: "transparent",
      color: "#3b6fd4",
    }),
    ...style,
  };
  return <button type="button" style={base} {...props} />;
}
