"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { IconButton } from "@/components/ui/Action";
import type { AppRoute } from "./AppHeader";

const ITEMS = [
  { key: "board", href: "/", label: "Board" },
  { key: "analytics", href: "/analytics", label: "Analytics" },
  { key: "companies", href: "/companies", label: "Companies" },
] as const;

const MENU_ID = "app-navigation-menu";

export function AppNavMenu({ current }: { current?: AppRoute }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const focusOnOpen = useRef<"first" | "last" | null>(null);
  const menuItems = () => Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);

  useLayoutEffect(() => {
    if (!open || !focusOnOpen.current) return;
    const items = menuItems();
    (focusOnOpen.current === "first" ? items[0] : items[items.length - 1])?.focus();
    focusOnOpen.current = null;
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node | null)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [open]);

  const openFromKeyboard = (which: "first" | "last") => {
    focusOnOpen.current = which;
    setOpen(true);
  };

  const onTriggerKeyDown = (event: React.KeyboardEvent) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    if (!open) return openFromKeyboard(event.key === "ArrowDown" ? "first" : "last");
    const items = menuItems();
    (event.key === "ArrowDown" ? items[0] : items[items.length - 1])?.focus();
  };

  const onMenuKeyDown = (event: React.KeyboardEvent) => {
    const items = menuItems();
    const index = items.indexOf(document.activeElement as HTMLElement);
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const next = event.key === "ArrowDown"
        ? (index + 1) % items.length
        : (index <= 0 ? items.length - 1 : index - 1);
      items[next]?.focus();
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      (event.key === "Home" ? items[0] : items[items.length - 1])?.focus();
    } else if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      rootRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    } else if (event.key === "Tab") {
      setOpen(false);
    } else if (event.key === " " && (event.target as HTMLElement).tagName === "A") {
      event.preventDefault();
      (event.target as HTMLElement).click();
    }
  };

  return (
    <div
      ref={rootRef}
      className="app-header__mobile-nav"
      onBlur={(event) => {
        if (!rootRef.current?.contains(event.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <IconButton
        label="Open navigation"
        icon="menu"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? MENU_ID : undefined}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={onTriggerKeyDown}
      />
      {open && (
        <div id={MENU_ID} ref={menuRef} role="menu" aria-label="Navigation" className="app-header__mobile-menu" onKeyDown={onMenuKeyDown}>
          {ITEMS.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              role="menuitem"
              tabIndex={-1}
              aria-current={current === item.key ? "page" : undefined}
              className="app-header__mobile-menu-item"
              onClick={() => setOpen(false)}
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
