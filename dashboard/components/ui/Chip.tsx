import type { CSSProperties, ReactNode } from "react";
import { Badge, type BadgeTone } from "./Panel";

export interface ChipProps {
  children: ReactNode;
  color?: string;
  bg?: string;
  border?: string;
  style?: CSSProperties;
  className?: string;
  tone?: BadgeTone;
}

export function Chip({ children, color, bg, border, style, className, tone = "neutral" }: ChipProps) {
  return (
    <Badge
      tone={tone}
      className={["rf-chip", className].filter(Boolean).join(" ")}
      style={{ color, background: bg, borderColor: border, ...style }}
    >
      {children}
    </Badge>
  );
}
