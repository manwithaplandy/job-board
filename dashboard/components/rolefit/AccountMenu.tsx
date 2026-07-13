"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";

export interface AccountMenuProps {
  email: string | null;
  // The account popup remains account-specific at every viewport. Responsive primary
  // navigation is owned by AppNavMenu, a separate affordance in the shared header.
  current?: "profile" | "billing" | "admin";
  // True only for ADMIN_EMAILS viewers (computed server-side from verified claims):
  // reveals an "Admin" link to the otherwise-unadvertised /admin console. Non-admins
  // are never passed true, so the link never renders — and the /admin pages re-gate
  // regardless, so this is purely a discoverability affordance, not the access control.
  isAdmin?: boolean;
}

const POPUP_ID = "account-menu-popup";

// Shared menuitem look. NB: no inline `background` — the `.rf-picker-option` class owns
// the transparent base (which also resets the sign-out <button>'s UA background) and the
// :hover fill; an inline background would shadow that hover rule (globals.css:67-73, same
// undefined-background approach as LocationPicker.tsx:204).
const itemStyle: CSSProperties = {
  display: "flex",
  width: "100%",
  padding: "8px 12px",
  borderRadius: "8px",
  fontSize: "13px",
  fontWeight: 600,
  color: "var(--text-primary)",
  textDecoration: "none",
  textAlign: "left",
  border: "none",
  cursor: "pointer",
  fontFamily: "inherit",
};

const separatorStyle: CSSProperties = { borderTop: "1px solid var(--bg-muted)", margin: "6px 0" };

// WAI-ARIA menu-button. The trigger is an initials avatar; the popup is a role=menu whose
// items are links + a same-origin sign-out form-POST. Sign out MUST stay a real form POST
// (not fetch/link/action): /auth/signout has a CSRF guard that 403s programmatic POSTs.
export function AccountMenu({ email, current, isAdmin = false }: AccountMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  // Which item to focus once the popup mounts, for keyboard opens ("first"/"last"); a
  // pointer open leaves focus on the trigger (null). Read + cleared by the layout effect.
  const focusOnOpen = useRef<"first" | "last" | null>(null);

  const menuItems = () =>
    Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);

  // Focus the requested item on the commit that mounts the popup (layout phase, pre-paint).
  useLayoutEffect(() => {
    if (!open) return;
    const which = focusOnOpen.current;
    focusOnOpen.current = null;
    if (!which) return;
    const items = menuItems();
    (which === "first" ? items[0] : items[items.length - 1])?.focus();
  }, [open]);

  // Click-outside close: a pointerdown anywhere outside the root closes without stealing
  // focus. Needed alongside the onBlur pattern because clicking a non-focusable page area
  // (and, historically, a macOS Safari button) may not move focus, so no blur fires.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node | null)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const onTriggerClick = (e: React.MouseEvent) => {
    // A keyboard activation (Enter/Space) reports detail 0 — open and land on the first
    // item. A pointer click just toggles and leaves focus on the trigger.
    if (!open && e.detail === 0) focusOnOpen.current = "first";
    setOpen((v) => !v);
  };

  const onTriggerKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const which = e.key === "ArrowDown" ? "first" : "last";
    if (open) {
      const items = menuItems();
      (which === "first" ? items[0] : items[items.length - 1])?.focus();
    } else {
      focusOnOpen.current = which;
      setOpen(true);
    }
  };

  const onMenuKeyDown = (e: React.KeyboardEvent) => {
    // Typeahead (jump to an item by typing its first letter) is intentionally out of scope.
    const items = menuItems();
    const idx = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      items[idx < 0 ? 0 : (idx + 1) % items.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      items[idx <= 0 ? items.length - 1 : idx - 1]?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      items[0]?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      items[items.length - 1]?.focus();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    } else if (e.key === "Tab") {
      // Let focus leave naturally (don't preventDefault); just keep aria-expanded honest.
      setOpen(false);
    } else if (e.key === " ") {
      // Space activates a link menuitem (a native <a> ignores Space). The sign-out
      // <button type="submit"> submits on Space natively — do not intercept it.
      const t = e.target as HTMLElement;
      if (t.tagName === "A" && t.getAttribute("role") === "menuitem") {
        e.preventDefault();
        t.click();
      }
    }
  };

  const close = () => setOpen(false);
  const initial = email?.[0]?.toUpperCase() ?? "•";

  return (
    <div
      ref={rootRef}
      style={{ position: "relative", flex: "0 0 auto" }}
      // Close when focus leaves the whole component (keyboard Tab-out / programmatic).
      onBlur={(e) => {
        if (!rootRef.current?.contains(e.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        className="rf-focusable"
        aria-haspopup="menu"
        aria-expanded={open}
        // Reference the popup id only while it's actually rendered (house convention).
        aria-controls={open ? POPUP_ID : undefined}
        aria-label={email ? `Account: ${email}` : "Account"}
        onClick={onTriggerClick}
        onKeyDown={onTriggerKeyDown}
        style={{
          width: "44px",
          height: "44px",
          borderRadius: "50%",
          background: "var(--accent-bg)",
          border: "1px solid var(--accent-border)",
          color: "var(--accent)",
          fontSize: "13px",
          fontWeight: 800,
          fontFamily: "inherit",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 0,
        }}
      >
        {initial}
      </button>

      {open && (
        <div
          ref={menuRef}
          id={POPUP_ID}
          role="menu"
          aria-label="Account"
          onKeyDown={onMenuKeyDown}
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 6px)",
            minWidth: "210px",
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: "12px",
            boxShadow: "0 8px 24px rgba(15,22,35,.1)",
            padding: "6px",
            zIndex: 30,
          }}
        >
          {email && (
            <>
              <div
                role="presentation"
                style={{
                  padding: "8px 12px",
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "var(--text-muted)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {email}
              </div>
              <div role="separator" style={separatorStyle} />
            </>
          )}

          <a
            role="menuitem"
            tabIndex={-1}
            href="/profile"
            aria-current={current === "profile" ? "page" : undefined}
            className="rf-picker-option"
            style={itemStyle}
            onClick={close}
          >
            Profile
          </a>
          <a
            role="menuitem"
            tabIndex={-1}
            href="/billing"
            aria-current={current === "billing" ? "page" : undefined}
            className="rf-picker-option"
            style={itemStyle}
            onClick={close}
          >
            Billing
          </a>

          {/* Admin console (ADMIN_EMAILS viewers only) — the sole UI entry point to the
              otherwise-unadvertised /admin/* pages. Lands on Tenants; its sub-nav reaches
              Invites. The pages re-gate on isAdmin, so hiding this is UX, not security. */}
          {isAdmin && (
            <a
              role="menuitem"
              tabIndex={-1}
              href="/admin/tenants"
              aria-current={current === "admin" ? "page" : undefined}
              className="rf-picker-option"
              style={itemStyle}
              onClick={close}
            >
              Admin
            </a>
          )}

          <div role="separator" style={separatorStyle} />

          {/* Sign out — a real same-origin form POST so sec-fetch-site is "same-origin" and
              clears the /auth/signout CSRF guard. role="none" keeps the form node from
              breaking the menu → menuitem ownership chain; the submit button is the
              semantic child. Do NOT convert to a link/fetch/server action. */}
          <form method="post" action="/auth/signout" role="none" style={{ margin: 0 }}>
            <button type="submit" role="menuitem" tabIndex={-1} className="rf-picker-option" style={itemStyle}>
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
