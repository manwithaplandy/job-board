// Everything but the kept elements made inert (spec 08 S6.3). While a view is expanded the
// page keeps the view frame and the dock and makes the rest inert, which is what bounds the
// Tab order: a keydown focus trap cannot work because the host page receives no key events
// while focus is inside a sandbox frame.
//
// For each kept element the walk goes up to document.body; at each level every sibling that
// is not itself on a kept path, and that `skip` does not exempt, gets `inert`. Only the
// elements this call made inert are remembered, so the restore function leaves an element
// that was already inert (by the page or another caller) as it found it. Restore is
// idempotent.

/** The toast region (sonner's `<section aria-label="Notifications …">`) and its list stay live while a view is expanded. */
export function isToastContainer(el: Element): boolean {
  if (el.hasAttribute("data-sonner-toaster")) return true;
  return el.tagName === "SECTION" && /^Notifications\b/.test(el.getAttribute("aria-label") ?? "");
}

export function inertOthers(keep: Element[], skip: (el: Element) => boolean = () => false): () => void {
  const body = document.body;
  // Every element on a path from a kept element up to body, the kept elements included.
  const onPath = new Set<Element>();
  for (const k of keep) {
    for (let e: Element | null = k; e && e !== body; e = e.parentElement) onPath.add(e);
  }
  const made: Element[] = [];
  const seen = new Set<Element>();
  for (const k of keep) {
    for (let e: Element | null = k; e && e !== body; e = e.parentElement) {
      const parent: Element | null = e.parentElement;
      if (!parent || seen.has(parent)) continue;
      seen.add(parent);
      for (const sibling of parent.children) {
        if (onPath.has(sibling) || skip(sibling) || sibling.hasAttribute("inert")) continue;
        sibling.setAttribute("inert", "");
        made.push(sibling);
      }
    }
  }
  let restored = false;
  return () => {
    if (restored) return;
    restored = true;
    for (const e of made) e.removeAttribute("inert");
  };
}
