import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Panel";
import { MEMO_SECTIONS } from "@/lib/workspaces/memoSchema";
import type { MemoVersion } from "@/lib/workspaces/types";

const WHO: Record<MemoVersion["changedBy"], string> = {
  user: "You",
  proposal: "Agent proposal you approved",
  restore: "Restored",
};

/**
 * The memo's version history, newest first (plan Task 1.8): who made each version,
 * when, its text, and Restore, which saves that text as a new version (history is
 * never rewritten). The current version has no Restore.
 */
export function MemoVersions({
  versions,
  currentVersion,
  pending,
  onRestore,
}: {
  versions: MemoVersion[];
  currentVersion: number;
  pending: boolean;
  onRestore: (version: number) => void;
}) {
  if (versions.length === 0) return <p className="rf-ws-section__empty">No saved versions yet.</p>;
  return (
    <ol className="rf-ws-versions" aria-label="Versions">
      {versions.map((v) => (
        <li key={v.version} className="rf-ws-versions__item">
          <div className="rf-ws-versions__head">
            <span className="rf-ws-versions__title">Version {v.version}</span>
            <span className="rf-ws-history__meta">
              {WHO[v.changedBy]} · <time dateTime={v.createdAt}>{v.createdAt.slice(0, 10)}</time>
            </span>
            {v.version === currentVersion ? (
              <Badge tone="success">Current</Badge>
            ) : (
              <Button variant="outline" size="sm" disabled={pending} onClick={() => onRestore(v.version)}>
                Restore
              </Button>
            )}
          </div>
          <details className="rf-ws-disclosure">
            <summary className="rf-ws-disclosure__summary">Show text</summary>
            <dl className="rf-ws-row__brief">
              {MEMO_SECTIONS.filter(({ key }) => v.doc[key].trim() !== "").map(({ key, label }) => (
                <div key={key}>
                  <dt>{label}</dt>
                  <dd>{v.doc[key]}</dd>
                </div>
              ))}
            </dl>
          </details>
        </li>
      ))}
    </ol>
  );
}
