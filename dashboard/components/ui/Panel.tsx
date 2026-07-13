import type { CSSProperties, ElementType, HTMLAttributes, ReactNode } from "react";

export interface PanelProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  style?: CSSProperties;
}

export function Panel({ children, style, className, ...props }: PanelProps) {
  return <div className={["rf-panel", className].filter(Boolean).join(" ")} style={style} {...props}>{children}</div>;
}

export interface CardProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType;
  children: ReactNode;
  padding?: "none" | "sm" | "md" | "lg";
}

export function Card({ as: Component = "div", padding = "md", className, children, ...props }: CardProps) {
  return <Component className={["rf-card", `rf-card--${padding}`, className].filter(Boolean).join(" ")} {...props}>{children}</Component>;
}

export type BadgeTone = "neutral" | "accent" | "success" | "warning" | "danger";

export function Badge({ tone = "neutral", className, ...props }: HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return <span className={["rf-badge", `rf-badge--${tone}`, className].filter(Boolean).join(" ")} {...props} />;
}
