// Shared slim top-nav for the off-board pages (Analytics/Companies/Profile). Server-safe
// (no client state): the logo links back to the board, and the three cross-page links let
// operators hop between subpages without returning to the board first. Reuses the main
// board Header's logo + link tokens so the surfaces read as one app; the current page is
// marked with a filled pill.

type NavKey = "analytics" | "companies" | "profile";

const NAV: { key: NavKey; href: string; label: string }[] = [
  { key: "analytics", href: "/analytics", label: "Analytics" },
  { key: "companies", href: "/companies", label: "Companies" },
  { key: "profile", href: "/profile", label: "Profile" },
];

export function SlimHeader({ current }: { current?: NavKey }) {
  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        gap: "16px",
        padding: "13px 22px",
        background: "#fff",
        borderBottom: "1px solid #e7eaf0",
      }}
    >
      {/* Logo + brand → back to the board */}
      <a
        href="/"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "11px",
          textDecoration: "none",
          flex: "0 0 auto",
        }}
      >
        <div
          style={{
            width: "31px",
            height: "31px",
            borderRadius: "9px",
            background: "#3b6fd4",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 3px 8px rgba(59,111,212,.32)",
          }}
        >
          <div
            style={{
              width: "11px",
              height: "11px",
              background: "#fff",
              borderRadius: "3px",
              transform: "rotate(45deg)",
            }}
          />
        </div>
        <div style={{ fontWeight: 800, fontSize: "18.5px", letterSpacing: "-.4px", color: "#1b2330" }}>
          Rolefit
        </div>
      </a>

      {/* Cross-page nav — the current page is marked (filled pill), others are plain links */}
      <nav aria-label="Pages" style={{ display: "flex", alignItems: "center", gap: "4px", marginLeft: "auto" }}>
        {NAV.map((n) => {
          const active = current === n.key;
          return (
            <a
              key={n.key}
              href={n.href}
              aria-current={active ? "page" : undefined}
              style={{
                fontWeight: 700,
                fontSize: "13px",
                textDecoration: "none",
                padding: "9px 12px",
                borderRadius: "9px",
                color: active ? "#1b2330" : "#3b6fd4",
                background: active ? "#eef3fc" : "transparent",
              }}
            >
              {n.label}
            </a>
          );
        })}
      </nav>
    </header>
  );
}
