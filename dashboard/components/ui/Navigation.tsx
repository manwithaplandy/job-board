"use client";

import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { Icon } from "./Icon";

export interface TabItem { label: string; href: string; active?: boolean; disabled?: boolean }

export function Tabs({ label, items, className }: { label: string; items: TabItem[]; className?: string }) {
  return <nav aria-label={label} className={["rf-tabs", className].filter(Boolean).join(" ")}><div className="rf-tabs__list">{items.map((item) => item.disabled
    ? <span key={item.href} aria-disabled="true" className="rf-tabs__item rf-tabs__item--disabled">{item.label}</span>
    : <a key={item.href} href={item.href} aria-current={item.active ? "page" : undefined} className="rf-tabs__item rf-focusable">{item.label}</a>)}</div></nav>;
}

export interface SegmentItem { label: string; value: string; disabled?: boolean }

export function SegmentedControl({ label, items, value, onChange, className }: { label: string; items: SegmentItem[]; value: string; onChange: (value: string) => void; className?: string }) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const enabled = items.map((item, index) => item.disabled ? -1 : index).filter((index) => index >= 0);
  const selectedIndex = items.findIndex((item) => item.value === value && !item.disabled);
  const tabStop = selectedIndex >= 0 ? selectedIndex : enabled[0];

  const move = (event: KeyboardEvent<HTMLButtonElement>, current: number) => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key) || enabled.length === 0) return;
    event.preventDefault();
    const position = enabled.indexOf(current);
    let next: number;
    if (event.key === "Home") next = enabled[0];
    else if (event.key === "End") next = enabled.at(-1)!;
    else {
      const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : -1;
      next = enabled[(position + step + enabled.length) % enabled.length];
    }
    refs.current[next]?.focus();
    onChange(items[next].value);
  };

  return <div role="radiogroup" aria-label={label} className={["rf-segments", className].filter(Boolean).join(" ")}>{items.map((item, index) => <button ref={(node) => { refs.current[index] = node; }} key={item.value} type="button" role="radio" aria-checked={item.value === value} disabled={item.disabled} tabIndex={index === tabStop ? 0 : -1} onKeyDown={(event) => move(event, index)} onClick={() => onChange(item.value)} className="rf-segments__item rf-focusable">{item.label}</button>)}</div>;
}

export function BackLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  const label = typeof children === "string" && children.toLowerCase().startsWith("back ")
    ? children
    : `Back to ${typeof children === "string" ? children : "previous page"}`;
  return <a href={href} className={["rf-back-link", "rf-focusable", className].filter(Boolean).join(" ")} aria-label={label}><Icon name="arrow-left" size={16} />{children}</a>;
}

export function PageHeader({ title, description, eyebrow, actions, className }: { title: ReactNode; description?: ReactNode; eyebrow?: ReactNode; actions?: ReactNode; className?: string }) {
  return <header className={["rf-page-header", className].filter(Boolean).join(" ")}><div className="rf-page-header__copy">{eyebrow && <div className="rf-page-header__eyebrow">{eyebrow}</div>}<h1>{title}</h1>{description && <p>{description}</p>}</div>{actions && <div className="rf-page-header__actions">{actions}</div>}</header>;
}

export function FormActions({ children, className }: { children: ReactNode; className?: string }) {
  return <div role="group" aria-label="Form actions" className={["rf-form-actions", className].filter(Boolean).join(" ")}>{children}</div>;
}
