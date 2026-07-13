import type { AnchorHTMLAttributes, ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

function buttonClasses(variant: ButtonVariant, size: ButtonSize, className?: string) {
  return ["rf-button", "rf-focusable", `rf-button--${variant}`, `rf-button--${size}`, className]
    .filter(Boolean)
    .join(" ");
}

// Keep the original inline geometry/colors while legacy screens migrate. Product
// components rely on inline style inspection and may pass small deltas via `style`.
function legacyButtonStyle(variant: ButtonVariant, size: ButtonSize, disabled: boolean, style?: CSSProperties): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    fontFamily: "inherit",
    fontWeight: 700,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.7 : 1,
    border: variant === "secondary" ? "1px solid var(--border)" : "none",
    borderRadius: size === "sm" ? "10px" : "11px",
    fontSize: size === "sm" ? "13.5px" : "14px",
    padding: size === "sm" ? "10px 16px" : size === "lg" ? "14px 24px" : "12px 20px",
    ...(variant === "primary" && { background: "var(--accent)", color: "var(--text-on-accent)", boxShadow: "var(--shadow-accent)" }),
    ...(variant === "secondary" && { background: "var(--bg-surface)", color: "var(--text-secondary)" }),
    ...(variant === "ghost" && { background: "transparent", color: "var(--accent)" }),
    ...(variant === "danger" && { background: "var(--danger)", color: "var(--text-on-accent)" }),
    ...style,
  };
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  loadingLabel?: string;
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  loadingLabel = "Loading",
  disabled,
  className,
  children,
  type = "button",
  style,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClasses(variant, size, className)}
      disabled={disabled || loading}
      style={legacyButtonStyle(variant, size, Boolean(disabled || loading), style)}
      aria-busy={loading || undefined}
      aria-label={loading ? loadingLabel : props["aria-label"]}
      {...props}
    >
      {loading && <span className="rf-button__spinner" aria-hidden="true" />}
      {children}
    </button>
  );
}

export interface ButtonLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: ButtonLinkProps) {
  return <a className={buttonClasses(variant, size, className)} {...props}>{children}</a>;
}
