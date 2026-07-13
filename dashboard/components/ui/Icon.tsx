import type { SVGAttributes } from "react";

export type IconName =
  | "arrow-left" | "arrow-right" | "check" | "chevron-down" | "chevron-right" | "chevron-up" | "close"
  | "copy" | "download" | "edit" | "menu" | "refresh" | "search" | "sparkle" | "star" | "upload" | "warning";
export type IconSize = 16 | 18 | 20;

const paths: Record<IconName, React.ReactNode> = {
  "arrow-left": <><path d="m10 4-6 6 6 6" /><path d="M4 10h12" /></>,
  "arrow-right": <><path d="m10 4 6 6-6 6" /><path d="M16 10H4" /></>,
  check: <path d="m4 10 4 4 8-8" />,
  "chevron-down": <path d="m5 7.5 5 5 5-5" />,
  "chevron-right": <path d="m7.5 5 5 5-5 5" />,
  "chevron-up": <path d="m5 12.5 5-5 5 5" />,
  close: <><path d="m5 5 10 10" /><path d="M15 5 5 15" /></>,
  copy: <><rect x="6" y="6" width="10" height="10" rx="2" /><path d="M4 13H3.5A1.5 1.5 0 0 1 2 11.5v-8A1.5 1.5 0 0 1 3.5 2h8A1.5 1.5 0 0 1 13 3.5V4" /></>,
  download: <><path d="M10 3v11" /><path d="m6 10 4 4 4-4" /><path d="M4 17h12" /></>,
  edit: <><path d="m13.5 3.5 3 3L7 16H4v-3z" /><path d="m11.5 5.5 3 3" /></>,
  menu: <><path d="M3 5h14" /><path d="M3 10h14" /><path d="M3 15h14" /></>,
  refresh: <><path d="M16 7V3l-2 2a7 7 0 1 0 2.2 7" /><path d="M16 3h-4" /></>,
  search: <><circle cx="9" cy="9" r="5.5" /><path d="m13 13 4 4" /></>,
  sparkle: <><path d="M10 2.5c.5 4 2.5 6 6.5 6.5-4 .5-6 2.5-6.5 6.5-.5-4-2.5-6-6.5-6.5 4-.5 6-2.5 6.5-6.5Z" /><path d="M16 2v3M17.5 3.5h-3" /></>,
  star: <path d="m10 2.5 2.2 4.6 5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5-3.6-3.5 5-.7Z" />,
  upload: <><path d="M10 14V3" /><path d="m6 7 4-4 4 4" /><path d="M4 12v4h12v-4" /></>,
  warning: <><path d="M10 3 18 17H2Z" /><path d="M10 8v4" /><path d="M10 15h.01" /></>,
};

export interface IconProps extends Omit<SVGAttributes<SVGSVGElement>, "name"> {
  name: IconName;
  size?: IconSize;
  label?: string;
}

export function Icon({ name, size = 18, label, className, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 20 20"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={["rf-icon", className].filter(Boolean).join(" ")}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
      {...props}
    >
      {paths[name]}
    </svg>
  );
}
