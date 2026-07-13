import type { RefObject } from "react";
import type { OperatorSignals } from "@/lib/types";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { AppHeader } from "@/components/shell/AppHeader";

export interface HeaderProps {
  search: string;
  onSearch: (value: string) => void;
  isAuthed: boolean;
  hasProfile: boolean;
  operator?: OperatorSignals;
  viewerEmail: string | null;
  isAdmin?: boolean;
  isNarrow?: boolean;
  onOpenProfile: () => void;
  searchRef?: RefObject<HTMLInputElement | null>;
}

const HEALTH_DOT: Record<OperatorSignals["health"], string> = {
  ok: "var(--status-ok)",
  warn: "var(--status-warn)",
  stale: "var(--status-stale)",
};

export function Header({ search, onSearch, isAuthed, hasProfile, operator, viewerEmail, isAdmin = false, isNarrow = false, onOpenProfile, searchRef }: HeaderProps) {
  const searchControl = (
    <label className="rf-search app-header__search">
      <Icon name="search" size={16} />
      <span className="sr-only">Search roles</span>
      <input
        ref={searchRef}
        type="search"
        aria-label="Search roles"
        value={search}
        onChange={(event) => onSearch(event.target.value)}
        placeholder="Search roles, companies, locations…"
      />
    </label>
  );

  const actions = (
    <>
      {operator && !isNarrow && (
        <div className="app-header__operator">
          <span
            role="img"
            aria-label={`Job Discovery health: ${operator.health}`}
            className="app-header__health"
            style={{ background: HEALTH_DOT[operator.health] }}
          />
          {operator.unreviewed > 0 && operator.reviewed > 0 && (
            <a href="/analytics">{operator.unreviewed} unreviewed</a>
          )}
        </div>
      )}
      {!isNarrow && <span className="app-header__reviewed-badge">AI-REVIEWED</span>}
      {isAuthed ? (
        <Button variant="primary" size="sm" onClick={onOpenProfile}>
          {hasProfile && <Icon name="edit" size={16} />}
          {hasProfile ? "Résumé" : "Set up profile"}
        </Button>
      ) : (
        <div className="app-header__auth-actions">
          <ButtonLink href="/login" variant="text-link" size="sm">Sign in</ButtonLink>
          <ButtonLink href="/signup" variant="primary" size="sm">Sign up</ButtonLink>
        </div>
      )}
    </>
  );

  return (
    <AppHeader
      current="board"
      email={viewerEmail}
      isAdmin={isAdmin}
      compact={isNarrow}
      showAccount={isAuthed}
      showPrimaryNav={isAuthed && !isNarrow}
      center={searchControl}
      actions={actions}
    />
  );
}
