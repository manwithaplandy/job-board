// Pure memo text work (plan Task 1.7): the memo compiled into the reviewer's
// instructions (profiles.instructions), and the per-section diff the confirm card shows.
// Deterministic: the same doc always compiles to the same text, so profile_version only
// changes when the memo does.
import { MEMO_SECTIONS } from "@/lib/workspaces/memoSchema";
import type { MemoDoc } from "@/lib/workspaces/types";

export const COMPILED_MEMO_MAX = 6000;

/**
 * `Label: text` per non-empty section, in MEMO_SECTIONS order, joined by blank lines and
 * cut to 6,000 characters (UTF-16 units, never splitting a surrogate pair). A section
 * that is only whitespace is empty; a section's text is trimmed.
 */
export function compileMemo(doc: MemoDoc): string {
  const parts: string[] = [];
  for (const { key, label } of MEMO_SECTIONS) {
    const text = doc[key].trim();
    if (text) parts.push(`${label}: ${text}`);
  }
  const out = parts.join("\n\n");
  if (out.length <= COMPILED_MEMO_MAX) return out;
  const cut = out.slice(0, COMPILED_MEMO_MAX);
  // Never end on half of a surrogate pair.
  const last = cut.charCodeAt(cut.length - 1);
  return last >= 0xd800 && last <= 0xdbff ? cut.slice(0, -1) : cut;
}

/** The sections whose text differs between `a` and `b`, in display order. */
export function diffMemo(a: MemoDoc, b: MemoDoc): Array<{ section: keyof MemoDoc; before: string; after: string }> {
  return MEMO_SECTIONS.filter(({ key }) => a[key] !== b[key]).map(({ key }) => ({
    section: key,
    before: a[key],
    after: b[key],
  }));
}
