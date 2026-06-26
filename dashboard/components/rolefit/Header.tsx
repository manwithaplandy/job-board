export interface HeaderProps {
  search: string;
  onSearch: (value: string) => void;
  isAuthed: boolean;
  onOpenProfile: () => void;
}

export function Header({ search, onSearch, isAuthed, onOpenProfile }: HeaderProps) {
  // Button styling: green if authed+profile (Task 14 adds profile check),
  // blue "Set up profile" if authed, blue "Sign in" if anon.
  const profileBtnLabel = isAuthed ? "Set up profile" : "Sign in";
  const profileBtnIcon = isAuthed ? "+" : "→";
  const profileBtnColor = "#ffffff";
  const profileBtnBg = "#3b6fd4";
  const profileBtnBorder = "#3b6fd4";

  return (
    <div
      style={{
        flex: "0 0 auto",
        display: "flex",
        alignItems: "center",
        gap: "16px",
        padding: "13px 22px",
        background: "#fff",
        borderBottom: "1px solid #e7eaf0",
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
        <div
          style={{ fontWeight: 800, fontSize: "18.5px", letterSpacing: "-.4px", color: "#1b2330" }}
        >
          Rolefit
        </div>
        <div
          style={{
            fontSize: "10px",
            fontWeight: 800,
            color: "#3b6fd4",
            background: "#eef3fc",
            border: "1px solid #d8e2f6",
            borderRadius: "20px",
            padding: "3px 8px",
            letterSpacing: ".5px",
          }}
        >
          AI-REVIEWED
        </div>
      </div>

      {/* Search */}
      <div
        style={{
          flex: 1,
          maxWidth: "460px",
          margin: "0 auto",
          display: "flex",
          alignItems: "center",
          gap: "10px",
          height: "39px",
          background: "#f3f5f9",
          border: "1px solid #e7eaf0",
          borderRadius: "11px",
          padding: "0 14px",
        }}
      >
        <svg
          width="15"
          height="15"
          viewBox="0 0 15 15"
          fill="none"
          style={{ flex: "0 0 auto" }}
        >
          <circle cx="6.4" cy="6.4" r="4.6" stroke="#9aa3b0" strokeWidth="1.7" />
          <line
            x1="9.9"
            y1="9.9"
            x2="13.4"
            y2="13.4"
            stroke="#9aa3b0"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        </svg>
        <input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search roles, companies, skills…"
          style={{
            flex: 1,
            border: "none",
            background: "transparent",
            outline: "none",
            fontSize: "13.5px",
            color: "#1f2430",
            minWidth: 0,
          }}
        />
      </div>

      {/* Profile button */}
      <button
        onClick={onOpenProfile}
        style={{
          flex: "0 0 auto",
          display: "inline-flex",
          alignItems: "center",
          gap: "8px",
          fontWeight: 700,
          fontSize: "13px",
          color: profileBtnColor,
          background: profileBtnBg,
          border: `1px solid ${profileBtnBorder}`,
          borderRadius: "11px",
          padding: "9px 14px",
          cursor: "pointer",
        }}
      >
        <span style={{ fontSize: "13px" }}>{profileBtnIcon}</span>
        <span>{profileBtnLabel}</span>
      </button>
    </div>
  );
}
