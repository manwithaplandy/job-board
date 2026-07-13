import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";

export type CanonicalButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "destructive" | "text-link";
/** `danger` is retained as a compatibility alias for the canonical destructive action. */
export type ButtonVariant = CanonicalButtonVariant | "danger";
export type ButtonSize = "compact" | "sm" | "md" | "lg";

function canonicalVariant(variant: ButtonVariant): CanonicalButtonVariant {
  return variant === "danger" ? "destructive" : variant;
}

function buttonClasses(variant: ButtonVariant, size: ButtonSize, className?: string) {
  return ["rf-button", "rf-focusable", `rf-button--${canonicalVariant(variant)}`, `rf-button--${size}`, className]
    .filter(Boolean)
    .join(" ");
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
  loadingLabel,
  disabled,
  className,
  children,
  type = "button",
  "aria-label": accessibleLabel,
  "aria-busy": consumerBusy,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      type={type}
      className={buttonClasses(variant, size, className)}
      disabled={disabled || loading}
      aria-busy={loading ? true : consumerBusy}
      aria-label={loading ? loadingLabel ?? accessibleLabel ?? "Loading" : accessibleLabel}
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

export function ButtonLink({ variant = "primary", size = "md", className, children, ...props }: ButtonLinkProps) {
  return <a className={buttonClasses(variant, size, className)} {...props}>{children}</a>;
}
