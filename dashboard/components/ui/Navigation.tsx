"use client";

import type { ReactNode } from "react";
import { Icon } from "./Icon";

export interface TabItem { label: string; href: string; active?: boolean; disabled?: boolean }

export function Tabs({ label, items, className }: { label: string; items: TabItem[]; className?: string }) {
  return <nav aria-label={label} className={["rf-tabs", className].filter(Boolean).join(" ")}><div className="rf-tabs__list">{items.map((item) => <a key={item.href} href={item.href} aria-current={item.active ? "page" : undefined} aria-disabled={item.disabled || undefined} className="rf-tabs__item rf-focusable">{item.label}</a>)}</div></nav>;
}

export interface SegmentItem { label: string; value: string; disabled?: boolean }

export function SegmentedControl({ label, items, value, onChange, className }: { label: string; items: SegmentItem[]; value: string; onChange: (value: string) => void; className?: string }) {
  return <div role="radiogroup" aria-label={label} className={["rf-segments", className].filter(Boolean).join(" ")}>{items.map((item) => <button key={item.value} type="button" role="radio" aria-checked={item.value === value} disabled={item.disabled} onClick={() => onChange(item.value)} className="rf-segments__item rf-focusable">{item.label}</button>)}</div>;
}

export function BackLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  return <a href={href} className={["rf-back-link", "rf-focusable", className].filter(Boolean).join(" ")} aria-label={`Back to ${typeof children === "string" ? children : "previous page"}`}><Icon name="arrow-left" size={16} />{children}</a>;
}

export function PageHeader({ title, description, eyebrow, actions, className }: { title: ReactNode; description?: ReactNode; eyebrow?: ReactNode; actions?: ReactNode; className?: string }) {
  return <header className={["rf-page-header", className].filter(Boolean).join(" ")}><div className="rf-page-header__copy">{eyebrow && <div className="rf-page-header__eyebrow">{eyebrow}</div>}<h1>{title}</h1>{description && <p>{description}</p>}</div>{actions && <div className="rf-page-header__actions">{actions}</div>}</header>;
}

export function FormActions({ children, className }: { children: ReactNode; className?: string }) {
  return <div role="group" aria-label="Form actions" className={["rf-form-actions", className].filter(Boolean).join(" ")}>{children}</div>;
}
