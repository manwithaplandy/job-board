import type { CSSProperties, RefObject } from "react";
import type { OperatorSignals } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { AccountMenu } from "./AccountMenu";

export interface HeaderProps {
  search: string;
  onSearch: (value: string) => void;
  isAuthed: boolean;
  hasProfile: boolean;
  operator?: OperatorSignals;
  // The viewer's email for the account menu; null for the anon board (no menu shown).
  viewerEmail: string | null;
  // True only for ADMIN_EMAILS viewers — surfaces the Admin link in the account menu.
  isAdmin?: boolean;
  // ≤760px: collapse the flat content nav + operator signals + badge into the account
  // menu so the header fits. Defaults false so the component stays usable standalone.
  isNarrow?: boolean;
  onOpenProfile: () => void;
  // Board keyboard nav focuses this input on `/`.
  searchRef?: RefObject<HTMLInputElement | null>;
}

const HEALTH_DOT: Record<OperatorSignals["health"], string> = {
  ok: "var(--status-ok)",
  warn: "var(--status-warn)",
  stale: "var(--status-stale)",
};

// Ghost nav-anchor style shared by the desktop content nav (Analytics, Companies) and
// the anon "Sign in" link — they read identically, so the tokens live in one place.
const NAV_ANCHOR_STYLE: CSSProperties = {
  fontWeight: 700,
  fontSize: "13px",
  color: "var(--accent)",
  textDecoration: "none",
  padding: "9px 6px",
};

export function Header({ search, onSearch, isAuthed, hasProfile, operator, viewerEmail, isAdmin = false, isNarrow = false, onOpenProfile, searchRef }: HeaderProps) {
  // Authed CTA label: "Résumé" when a saved profile exists (opens the résumé-only
  // modal — the "Profile" link handles full settings); "Set up profile" otherwise.
  // Anonymous visitors get Sign in / Sign up anchors instead (see the CTA cluster).
  const profileBtnLabel = hasProfile ? "Résumé" : "Set up profile";
  const profileBtnIcon = hasProfile ? "✎" : "+";

  return (
    <div
      style={{
        flex: "0 0 auto",
        display: "flex",
        alignItems: "center",
        gap: "16px",
        padding: "13px 22px",
        background: "var(--bg-surface)",
        borderBottom: "1px solid var(--border)",
        zIndex: 20,
      }}
    >
      {/* Logo + brand */}
      <div style={{ display: "flex", alignItems: "center", gap: "11px", flex: "0 0 auto" }}>
        <div
          style={{
            width: "31px",
            height: "31px",
            borderRadius: "9px",
            background: "var(--accent)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "var(--shadow-accent-sm)",
          }}
        >
          <div
            style={{
              width: "11px",
              height: "11px",
              background: "var(--text-on-accent)",
              borderRadius: "3px",
              transform: "rotate(45deg)",
            }}
          />
        </div>
        <div
          style={{ fontWeight: 800, fontSize: "18.5px", letterSpacing: "-.4px", color: "var(--text-primary)" }}
        >
          Rolefit
        </div>
        {!isNarrow && (
          <div
            style={{
              fontSize: "10px",
              fontWeight: 800,
              color: "var(--accent)",
              background: "var(--accent-bg)",
              border: "1px solid var(--accent-border)",
              borderRadius: "20px",
              padding: "3px 8px",
              letterSpacing: ".5px",
            }}
          >
            AI-REVIEWED
          </div>
        )}
      </div>

      {/* Search */}
      <div
        className="rf-search"
        style={{
          flex: 1,
          maxWidth: "460px",
          margin: "0 auto",
          display: "flex",
          alignItems: "center",
          gap: "10px",
          height: "39px",
          background: "var(--bg-muted)",
          border: "1px solid var(--border)",
          borderRadius: "11px",
          padding: "0 14px",
        }}
      >
        {/* Search glyph. Stroke uses currentColor so the muted token (a CSS var, invalid
            in an SVG presentation attribute) can drive it via the svg's `color`. */}
        <svg
          width="15"
          height="15"
          viewBox="0 0 15 15"
          fill="none"
          style={{ flex: "0 0 auto", color: "var(--text-muted)" }}
        >
          <circle cx="6.4" cy="6.4" r="4.6" stroke="currentColor" strokeWidth="1.7" />
          <line
            x1="9.9"
            y1="9.9"
            x2="13.4"
            y2="13.4"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        </svg>
        <input
          ref={searchRef}
          type="search"
          aria-label="Search roles"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search roles, companies, locations…"
          style={{
            flex: 1,
            border: "none",
            // Focus is shown on the .rf-search pill wrapper (:focus-within); suppress the
            // input's own native outline so it doesn't draw a sharp rectangle inside the pill.
            outline: "none",
            background: "transparent",
            fontSize: "13.5px",
            color: "var(--text-primary)",
            minWidth: 0,
          }}
        />
      </div>

      {/* Right cluster: operator signals (authed only) + profile button */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: "0 0 auto" }}>
        {operator && !isNarrow && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "7px",
              fontSize: "12px",
              color: "var(--text-secondary)",
              fontWeight: 500,
            }}
          >
            {/* Run-health dot — color is decorative, so carry the health word as a
                text alternative for AT (the dot is non-interactive; title alone is
                unreachable by keyboard/screen readers). */}
            <span
              role="img"
              aria-label={`Job Discovery health: ${operator.health}`}
              style={{
                display: "inline-block",
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: HEALTH_DOT[operator.health],
                flexShrink: 0,
              }}
              title={`Job Discovery health: ${operator.health}`}
            />
            {/* Unreviewed count — links to pipeline health. Hidden until the viewer's first
                review lands (reviewed > 0): on a brand-new account the count is the whole
                location-scoped pool, which is just alarming noise next to an empty board
                (ReviewNowPanel already communicates the first-run state). */}
            {operator.unreviewed > 0 && operator.reviewed > 0 && (
              <a
                href="/analytics"
                style={{ color: "var(--accent)", fontWeight: 600, textDecoration: "none" }}
              >
                {operator.unreviewed} unreviewed
              </a>
            )}
          </div>
        )}

        {/* Content nav — top-level on desktop; folds into the account menu (includeNav)
            at narrow widths so the header fits. */}
        {isAuthed && !isNarrow && (
          <a href="/analytics" style={NAV_ANCHOR_STYLE}>
            Analytics
          </a>
        )}

        {isAuthed && !isNarrow && (
          <a href="/companies" style={NAV_ANCHOR_STYLE}>
            Companies
          </a>
        )}

        {/* CTA cluster. Authed: the Résumé / Set-up-profile button (the board's
            primary action). Anon: real navigation anchors — secondary "Sign in" then
            the primary "Sign up" rightmost (most prominent). Anchors, not <Button>,
            so middle-click/new-tab semantics work (Button renders a hardcoded
            <button>); tokens mirror components/ui/Button.tsx primary (--accent fill,
            --text-on-accent text, --shadow-accent) and the nav-anchor ghost style. */}
        {isAuthed ? (
          <Button
            variant="primary"
            onClick={onOpenProfile}
            style={{
              fontSize: "13px",
              padding: "9px 14px",
              border: "1px solid var(--accent)",
              boxShadow: "none",
            }}
          >
            <span style={{ fontSize: "13px" }}>{profileBtnIcon}</span>
            <span>{profileBtnLabel}</span>
          </Button>
        ) : (
          <>
            <a href="/login" style={NAV_ANCHOR_STYLE}>
              Sign in
            </a>
            <a
              href="/signup"
              style={{
                display: "inline-flex",
                alignItems: "center",
                fontWeight: 700,
                fontSize: "13px",
                color: "var(--text-on-accent)",
                background: "var(--accent)",
                border: "1px solid var(--accent)",
                borderRadius: "11px",
                padding: "9px 14px",
                textDecoration: "none",
                boxShadow: "var(--shadow-accent)",
              }}
            >
              Sign up
            </a>
          </>
        )}

        {/* Account menu (Profile / Billing / Sign out; +Analytics/Companies when narrow) —
            far-corner resident. Authed-only; the anonymous board's CTA is the
            Sign in / Sign up anchor pair above. */}
        {isAuthed && <AccountMenu email={viewerEmail} includeNav={isNarrow} isAdmin={isAdmin} />}
      </div>
    </div>
  );
}
