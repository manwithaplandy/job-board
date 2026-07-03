// Pure selection math for the board's keyboard nav (#3), scroll-into-view (#5), and
// auto-advance after reject/apply (#2). Kept out of the React component so it is unit-
// testable (vitest is node-only). `ids` is always the CURRENT visible order.

export function indexOfId(ids: string[], id: string | null): number {
  if (id == null) return -1;
  return ids.indexOf(id);
}

export function stepSelection(ids: string[], current: string | null, dir: 1 | -1): string | null {
  if (ids.length === 0) return null;
  const i = indexOfId(ids, current);
  if (i === -1) return dir === 1 ? ids[0] : ids[ids.length - 1];
  const next = Math.min(ids.length - 1, Math.max(0, i + dir));
  return ids[next];
}

// `ids` is the visible order BEFORE removal. After `removedId` leaves, prefer the item
// that slides into its index; else the new last item; else null.
export function selectionAfterRemoval(ids: string[], removedId: string): string | null {
  const i = ids.indexOf(removedId);
  if (i === -1) return null;
  const remaining = ids.filter((id) => id !== removedId);
  if (remaining.length === 0) return null;
  return remaining[Math.min(i, remaining.length - 1)];
}
