export interface UpgradeCta {
  href: string;
  label: string;
}

export type SectionSaveState =
  | { status: "idle" }
  | { status: "success"; savedAt: string }
  | { status: "error"; message: string; fieldErrors: Record<string, string>; upgrade?: UpgradeCta };

export const INITIAL_SECTION_SAVE_STATE: SectionSaveState = { status: "idle" };
