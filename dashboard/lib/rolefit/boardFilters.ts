import type { BoardFilterState } from "@/lib/rolefit/filter";
import { DEFAULT_FILTERS } from "@/lib/rolefit/filter";

const REMOTE = new Set<BoardFilterState["remote"]>(["all", "remote", "hybrid", "onsite"]);
const SORT = new Set<BoardFilterState["sort"]>(["match", "pay", "newest", "az"]);
const MAX_SEARCH = 200;
const MAX_ITEMS = 50;
const MAX_ITEM_LEN = 120;

function strList(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const x of v) {
    if (typeof x === "string" && x.length <= MAX_ITEM_LEN) out.push(x);
    if (out.length >= MAX_ITEMS) break;
  }
  return out;
}

function nonNegNum(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : 0;
}

function defaults(): BoardFilterState {
  return { ...DEFAULT_FILTERS, cats: [], locs: [], sources: [] };
}

export function parseBoardFilters(raw: unknown): BoardFilterState {
  let obj: unknown = raw;
  if (typeof raw === "string") {
    // LOAD-BEARING string tolerance — do NOT remove. Legit string inputs: the anon
    // board-filter cookie (app/api/board-filters/route.ts stores serializeBoardFilters())
    // replayed at login (app/login/page.tsx), plus legacy double-encoded
    // profiles.board_filters rows. The write path (saveBoardFilters) now stores jsonb
    // objects, but this branch must stay for those inputs.
    try { obj = JSON.parse(raw); } catch { return defaults(); }
  }
  if (obj == null || typeof obj !== "object") return defaults();
  const o = obj as Record<string, unknown>;
  return {
    search: typeof o.search === "string" ? o.search.slice(0, MAX_SEARCH) : DEFAULT_FILTERS.search,
    cats: strList(o.cats),
    locs: strList(o.locs),
    sources: strList(o.sources),
    remote: REMOTE.has(o.remote as BoardFilterState["remote"])
      ? (o.remote as BoardFilterState["remote"]) : DEFAULT_FILTERS.remote,
    minFit: nonNegNum(o.minFit),
    payMin: nonNegNum(o.payMin),
    sort: SORT.has(o.sort as BoardFilterState["sort"])
      ? (o.sort as BoardFilterState["sort"]) : DEFAULT_FILTERS.sort,
  };
}

export function serializeBoardFilters(f: BoardFilterState): string {
  return JSON.stringify(f);
}
