import type { ButtonHTMLAttributes } from "react";
import { Icon, type IconName, type IconSize } from "./Icon";

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "aria-label"> {
  label: string;
  icon: IconName;
  iconSize?: IconSize;
  size?: "sm" | "md";
  tone?: "default" | "danger";
}

export function IconButton({ label, icon, iconSize = 18, size = "md", tone = "default", className, type = "button", ...props }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      className={["rf-icon-button", "rf-focusable", `rf-icon-button--${size}`, `rf-icon-button--${tone}`, className].filter(Boolean).join(" ")}
      {...props}
    >
      <Icon name={icon} size={iconSize} />
    </button>
  );
}
